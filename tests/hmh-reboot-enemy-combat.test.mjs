import assert from 'node:assert/strict';
import test from 'node:test';

import { createStaticBlocker } from '../apps/hmh-reboot/src/collision.mjs';
import {
  MAX_ENEMY_ATTACK_EVENTS,
  resolveEnemyAttackAgainstPlayer,
  stepEnemyAttacks,
} from '../apps/hmh-reboot/src/enemy-combat.mjs';
import { createEnemyState } from '../apps/hmh-reboot/src/enemy-simulation.mjs';

function enemy(archetypeId, id, x, y = 0) {
  return createEnemyState({ archetypeId, id, x, y, groundZ: 0, visualMode: 'prototype' });
}

const player = { id: 'player', x: 0, y: 0, groundZ: 0, radius: 24 };

test('melee attack reserves one token, exposes the full tell, then resolves once into recovery', () => {
  const rusher = enemy('bagholder-rusher', 'rusher', 50);
  const start = stepEnemyAttacks({ enemies: [rusher], player, tick: 1 });
  assert.equal(start.events.length, 0);
  assert.equal(rusher.attackPhase, 'tell');
  assert.equal(rusher.attackPhaseUntilTick, 16);
  assert.deepEqual(rusher.telegraphTarget, { x: 0, y: 0, groundZ: 0 });

  assert.equal(stepEnemyAttacks({ enemies: [rusher], player, tick: 15 }).events.length, 0);
  const strike = stepEnemyAttacks({ enemies: [rusher], player, tick: 16 });
  assert.equal(strike.events.length, 1);
  assert.equal(strike.events[0].enemyId, 'rusher');
  assert.equal(strike.events[0].tokenFamily, 'melee');
  assert.equal(strike.events[0].tellStartedTick, 1);
  assert.equal(rusher.attackPhase, 'recovery');
  assert.equal(resolveEnemyAttackAgainstPlayer(strike.events[0], { player, invulnerable: false }).hit, true);
  assert.equal(stepEnemyAttacks({ enemies: [rusher], player, tick: 17 }).events.length, 0);
});

test('locked ranged and area telegraphs remain dodgeable instead of tracking the player after tell start', () => {
  for (const [archetypeId, id] of [['liquidator-agent', 'agent'], ['gas-bomber', 'bomber']]) {
    const attacker = enemy(archetypeId, id, 300);
    stepEnemyAttacks({ enemies: [attacker], player, tick: 1 });
    const movedPlayer = { ...player, x: 0, y: 300 };
    const resolutionTick = attacker.attackPhaseUntilTick;
    const result = stepEnemyAttacks({ enemies: [attacker], player: movedPlayer, tick: resolutionTick });
    assert.equal(result.events.length, 1, archetypeId);
    assert.deepEqual(result.events[0].target, { x: 0, y: 0, groundZ: 0 }, archetypeId);
    assert.equal(resolveEnemyAttackAgainstPlayer(result.events[0], { player: movedPlayer, invulnerable: false }).hit, false, archetypeId);
  }
});

test('authored height-aware cover blocks ranged lane resolution', () => {
  const agent = enemy('liquidator-agent', 'covered-agent', 300);
  stepEnemyAttacks({ enemies: [agent], player, tick: 1 });
  const event = stepEnemyAttacks({ enemies: [agent], player, tick: agent.attackPhaseUntilTick }).events[0];
  const wall = createStaticBlocker({
    id: 'cover-wall',
    shape: { type: 'polygon', vertices: [{ x: 140, y: -80 }, { x: 160, y: -80 }, { x: 160, y: 80 }, { x: 140, y: 80 }] },
    visibleAssetId: 'visible-cover-wall', minZ: 0, maxZ: 96,
  });
  const result = resolveEnemyAttackAgainstPlayer(event, { player, invulnerable: false, blockers: [wall] });
  assert.equal(result.hit, false);
  assert.equal(result.reason, 'cover');
});

test('attack tokens keep only a readable subset in tell and release distant melee reservations', () => {
  const rushers = Array.from({ length: 8 }, (_, index) => enemy('bagholder-rusher', `r-${index}`, 70 + index));
  stepEnemyAttacks({ enemies: rushers, player, tick: 1 });
  assert.equal(rushers.filter((entry) => entry.attackPhase === 'tell').length, 3);
  const reserved = rushers.find((entry) => entry.attackPhase === 'tell');
  reserved.x = 1000;
  stepEnemyAttacks({ enemies: rushers, player, tick: 2 });
  assert.equal(reserved.attackPhase, 'ready');
  assert.equal(reserved.telegraphTarget, null);
});

test('event ordering and token choices are stable when enemy source order reverses', () => {
  const make = () => [
    enemy('bagholder-rusher', 'r-b', 60),
    enemy('bagholder-rusher', 'r-a', 60),
    enemy('liquidator-agent', 'l-a', 300),
    enemy('gas-bomber', 'g-a', 320),
    enemy('validator-cultist', 'v-a', 340),
  ];
  const a = make();
  const b = make().reverse();
  stepEnemyAttacks({ enemies: a, player, tick: 1 });
  stepEnemyAttacks({ enemies: b, player, tick: 1 });
  for (const entry of [...a, ...b]) entry.attackPhaseUntilTick = 2;
  const first = stepEnemyAttacks({ enemies: a, player, tick: 2 });
  const second = stepEnemyAttacks({ enemies: b, player, tick: 2 });
  assert.deepEqual(first.events, second.events);
  assert.deepEqual(first.tokens, second.tokens);
});

test('support pulse has no player damage and Dash invulnerability suppresses damaging events', () => {
  const cultist = enemy('validator-cultist', 'cultist', 300);
  stepEnemyAttacks({ enemies: [cultist], player, tick: 1 });
  const support = stepEnemyAttacks({ enemies: [cultist], player, tick: cultist.attackPhaseUntilTick }).events[0];
  assert.equal(support.damage, 0);
  assert.equal(support.geometry.type, 'support-ring');
  assert.equal(resolveEnemyAttackAgainstPlayer(support, { player, invulnerable: false }).hit, false);

  const rusher = enemy('bagholder-rusher', 'rusher', 50);
  stepEnemyAttacks({ enemies: [rusher], player, tick: 1 });
  const strike = stepEnemyAttacks({ enemies: [rusher], player, tick: rusher.attackPhaseUntilTick }).events[0];
  assert.equal(resolveEnemyAttackAgainstPlayer(strike, { player, invulnerable: true }).hit, false);
});

test('attack event pool is hard-capped with truthful overflow telemetry', () => {
  assert.equal(MAX_ENEMY_ATTACK_EVENTS, 64);
  const rushers = Array.from({ length: 100 }, (_, index) => enemy('bagholder-rusher', `r-${String(index).padStart(3, '0')}`, 50));
  for (const entry of rushers) {
    entry.attackPhase = 'tell';
    entry.attackPhaseUntilTick = 10;
    entry.attackTellStartedTick = 1;
    entry.telegraphTarget = { x: 0, y: 0, groundZ: 0 };
  }
  const result = stepEnemyAttacks({
    enemies: rushers,
    player,
    tick: 10,
    budgets: { melee: 100, ranged: 0, area: 0, support: 0 },
  });
  assert.equal(result.events.length, MAX_ENEMY_ATTACK_EVENTS);
  assert.equal(result.droppedEvents, 36);
  assert.equal(result.events[0].enemyId, 'r-000');
  assert.equal(result.events.at(-1).enemyId, 'r-063');
});

test('enemy combat fails closed on malformed inputs', () => {
  assert.throws(() => stepEnemyAttacks({ enemies: null, player, tick: 1 }), /enemies/);
  assert.throws(() => stepEnemyAttacks({ enemies: [], player, tick: -1 }), /tick/);
  assert.throws(() => resolveEnemyAttackAgainstPlayer(null, { player }), /event/);
  assert.throws(() => resolveEnemyAttackAgainstPlayer({ damage: 1 }, { player }), /geometry/);
});
