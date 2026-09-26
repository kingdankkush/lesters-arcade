import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  MAIN_CONSTANTS,
  WEAPON_KNOCKBACK,
  WEAPON_ORDER,
  runSimDigestScenario,
} from '../scripts/hmh-sim-digest.mjs';

const mainSource = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');

test('the digest mirror pins the module-private tick constants of main.mjs', () => {
  for (const name of ['PROJECTILE_FLIGHT_HEIGHT', 'PROJECTILE_GRID_THRESHOLD', 'CRITICAL_CHANCE_CAP', 'BASE_CRITICAL_CHANCE', 'BASE_CRITICAL_MULTIPLIER', 'ENEMY_FLOW_REFRESH_TICKS']) {
    const match = new RegExp(`^const ${name} = ([0-9._]+);`, 'm').exec(mainSource);
    assert.ok(match, `${name} not found in main.mjs`);
    assert.equal(MAIN_CONSTANTS[name], Number(match[1].replaceAll('_', '')), name);
  }
  assert.match(mainSource, new RegExp(`endurancePressurePilotEnabled \\? ${MAIN_CONSTANTS.ENDURANCE_TICK_OFFSET.toLocaleString('en-US').replace(',', '_')} : 0`));
  const order = /^const WEAPON_ORDER = Object\.freeze\((\[[^\]]+\])\);/m.exec(mainSource);
  assert.deepEqual(JSON.parse(order[1].replaceAll("'", '"')), [...WEAPON_ORDER]);
  const knockback = /const WEAPON_KNOCKBACK = Object\.freeze\(\{([^}]+)\}\);/m.exec(mainSource)[1];
  for (const [weaponId, value] of Object.entries(WEAPON_KNOCKBACK)) {
    assert.match(knockback, new RegExp(`'?${weaponId}'?: ${value},`), weaponId);
  }
});

test('the crowd digest is same-seed identical and seed sensitive', () => {
  const first = runSimDigestScenario({ scenario: 'crowd', ticks: 180, checkpointEvery: 60 });
  const second = runSimDigestScenario({ scenario: 'crowd', ticks: 180, checkpointEvery: 60 });
  assert.equal(first.digest, second.digest);
  assert.deepEqual(first.checkpoints, second.checkpoints);
  assert.equal(first.counters.maxEnemies, 128, 'the crowd scenario starts from the 128-body endurance pilot');
  assert.match(first.digest, /^[0-9a-f]{64}$/);
  const otherSeed = runSimDigestScenario({ scenario: 'crowd', seed: 7, ticks: 180, checkpointEvery: 60 });
  assert.notEqual(otherSeed.digest, first.digest);
});

test('the director digest is same-seed identical and holds the opening pair', () => {
  const first = runSimDigestScenario({ scenario: 'director', ticks: 120, checkpointEvery: 60 });
  const second = runSimDigestScenario({ scenario: 'director', ticks: 120, checkpointEvery: 60 });
  assert.equal(first.digest, second.digest);
  assert.equal(first.counters.maxEnemies, 2, 'director opens with the authored opening pair');
  assert.equal(first.counters.directorInsertions, 0, 'no director spawn before tick 600');
});
