import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ENEMY_ARCHETYPE_IDS,
  ENEMY_ARCHETYPES,
  REQUIRED_ENEMY_VISUAL_STATES,
  getEnemyArchetype,
} from '../apps/hmh-reboot/src/enemy-archetypes.mjs';

const EXPECTED_IDS = [
  'bagholder-rusher',
  'forkrunner',
  'gas-bomber',
  'liquidator-agent',
  'validator-cultist',
  'whale-enforcer',
];

test('Phase 14 approves six human/zombie roles with no animal or mech proxy', () => {
  assert.deepEqual([...ENEMY_ARCHETYPE_IDS].sort(), EXPECTED_IDS);
  assert.equal(Object.keys(ENEMY_ARCHETYPES).length, 6);
  const names = new Set();
  const roles = new Set();
  for (const id of ENEMY_ARCHETYPE_IDS) {
    const archetype = getEnemyArchetype(id);
    assert.equal(archetype.id, id);
    assert.equal(['human', 'zombie'].includes(archetype.identityForm), true, id);
    assert.doesNotMatch(`${archetype.name} ${archetype.identityForm} ${archetype.faction}`, /animal|beast|mech|robot/i);
    assert.equal(names.has(archetype.name), false);
    assert.equal(roles.has(archetype.role), false);
    names.add(archetype.name);
    roles.add(archetype.role);
  }
});

test('every role has bounded body, threat, attack, movement, and honest counterplay data', () => {
  for (const archetype of Object.values(ENEMY_ARCHETYPES)) {
    assert.ok(archetype.radius >= 16 && archetype.radius <= 38, archetype.id);
    assert.ok(archetype.speed > 0 && archetype.speed <= 240, archetype.id);
    assert.ok(archetype.maxHealth > 0, archetype.id);
    assert.ok(Number.isInteger(archetype.costs.body) && archetype.costs.body === 1, archetype.id);
    for (const key of ['threat', 'ranged', 'projectile', 'effect']) {
      assert.ok(Number.isInteger(archetype.costs[key]) && archetype.costs[key] >= 0, `${archetype.id}.${key}`);
    }
    assert.equal(['melee', 'ranged', 'area', 'support'].includes(archetype.attack.tokenFamily), true, archetype.id);
    assert.ok(Number.isInteger(archetype.attack.tellTicks) && archetype.attack.tellTicks >= 12, archetype.id);
    assert.ok(Number.isInteger(archetype.attack.recoveryTicks) && archetype.attack.recoveryTicks >= 12, archetype.id);
    assert.ok(Number.isInteger(archetype.attack.damage) && archetype.attack.damage >= 0, archetype.id);
    assert.equal(archetype.attack.tokenFamily === 'support' ? archetype.attack.damage === 0 : archetype.attack.damage > 0, true, archetype.id);
    assert.ok(archetype.attack.range > archetype.radius, archetype.id);
    assert.ok(archetype.attack.reserveRange >= archetype.attack.range, archetype.id);
    assert.ok(archetype.counterplay.length >= 24, archetype.id);
    assert.ok(archetype.telegraph.length >= 12, archetype.id);
    assert.ok(archetype.movement.maxCurbHeight >= 0, archetype.id);
    assert.ok(archetype.movement.maxDropHeight >= 0, archetype.id);
    assert.ok(archetype.movement.maxAuthoredAscent >= 0, archetype.id);
    assert.ok(archetype.movement.shallowWaterMultiplier > 0 && archetype.movement.shallowWaterMultiplier <= 1, archetype.id);
  }
});

test('S5 measured stat corrections preserve distinct pressure roles', () => {
  assert.deepEqual(
    Object.fromEntries(ENEMY_ARCHETYPE_IDS.map((id) => {
      const enemy = getEnemyArchetype(id);
      return [id, { health: enemy.maxHealth, armor: enemy.armor, speed: enemy.speed, damage: enemy.attack.damage }];
    })),
    {
      'bagholder-rusher': { health: 80, armor: 1, speed: 184, damage: 12 },
      forkrunner: { health: 64, armor: 1, speed: 216, damage: 8 },
      'liquidator-agent': { health: 96, armor: 1.1, speed: 140, damage: 10 },
      'whale-enforcer': { health: 240, armor: 1.35, speed: 96, damage: 18 },
      'gas-bomber': { health: 100, armor: 1.05, speed: 124, damage: 16 },
      'validator-cultist': { health: 110, armor: 1.05, speed: 116, damage: 0 },
    },
  );
});

test('prototype and production silhouettes cover all combat states with elite visuals enabled', () => {
  assert.deepEqual(REQUIRED_ENEMY_VISUAL_STATES, ['idle', 'run', 'tell', 'attack', 'hit', 'death']);
  for (const archetype of Object.values(ENEMY_ARCHETYPES)) {
    assert.deepEqual(archetype.visual.prototypeStates, REQUIRED_ENEMY_VISUAL_STATES, archetype.id);
    assert.equal(archetype.visual.prototypeComplete, true, archetype.id);
    assert.equal(archetype.visual.productionComplete, true, archetype.id);
    assert.equal(archetype.visual.eliteEnabled, true, archetype.id);
    assert.match(archetype.visual.silhouette, /^(wedge|diamond|square|hexagon|orb|star)$/);
  }
});

test('unknown archetypes fail closed', () => {
  assert.throws(() => getEnemyArchetype('literal-whale'), /Unknown enemy archetype/);
  assert.throws(() => getEnemyArchetype(null), /Unknown enemy archetype/);
});
