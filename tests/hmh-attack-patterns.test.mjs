import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ENEMY_ATTACK_PATTERN_CATALOG,
  planEnemyAttackPattern,
  validateDodgePathForPattern,
} from '../apps/portal/src/hmh-attack-patterns.mjs';

const REQUIRED = ['aimed-burst', 'radial-nova', 'lobbed-mortar', 'line-dash', 'summoner', 'zone-spitter'];

test('WO-44 attack-pattern catalog gives each special verb a tell, counterplay, and dodge contract', () => {
  assert.deepEqual(ENEMY_ATTACK_PATTERN_CATALOG.map((pattern) => pattern.id).sort(), REQUIRED.slice().sort());
  for (const pattern of ENEMY_ATTACK_PATTERN_CATALOG) {
    assert.ok(pattern.telegraphDecal, `${pattern.id} needs a decal/tell`);
    assert.ok(pattern.visualTell, `${pattern.id} needs a visual tell`);
    assert.ok(pattern.counterplay.length >= 1, `${pattern.id} needs counterplay`);
    assert.ok(pattern.frequencyPressureScale > 1, `${pattern.id} should scale frequency/pattern density, not damage`);
    assert.equal(Object.hasOwn(pattern, 'damageMultiplier'), false, `${pattern.id} must not inflate damage directly`);
  }
});

test('WO-44 planner maps shipped archetypes to distinct learnable threat verbs', () => {
  const cases = [
    ['claim-jumper-sheriff', 'aimed-burst'],
    ['honeypot-turret', 'radial-nova'],
    ['evil-banker-ranged', 'lobbed-mortar'],
    ['coyote-pack-runner', 'line-dash'],
    ['scam-cult-zealot', 'summoner'],
    ['gas-beast-tank', 'zone-spitter'],
  ];
  for (const [enemyId, expected] of cases) {
    const plan = planEnemyAttackPattern({ enemyId, pressure: 0.82, seed: 42, origin: { x: 0, y: 0 }, target: { x: 4, y: 1 } });
    assert.equal(plan.patternId, expected, `${enemyId} should use ${expected}`);
    assert.ok(plan.telegraphFrames >= 24, `${enemyId} needs readable windup`);
    assert.ok(plan.actions.length >= 1, `${enemyId} should emit gameplay actions`);
  }
});

test('WO-44 pattern pressure scales volley/zone density instead of raw damage', () => {
  const early = planEnemyAttackPattern({ enemyId: 'claim-jumper-sheriff', pressure: 0.1, seed: 7, origin: { x: 0, y: 0 }, target: { x: 5, y: 0 } });
  const late = planEnemyAttackPattern({ enemyId: 'claim-jumper-sheriff', pressure: 0.95, seed: 7, origin: { x: 0, y: 0 }, target: { x: 5, y: 0 } });
  assert.ok(late.actions.filter((action) => action.type === 'shot').length >= early.actions.filter((action) => action.type === 'shot').length);
  assert.equal(late.damageMultiplier, 1);
});

test('WO-44 every pattern has a valid dash/dodge escape contract', () => {
  for (const catalogPattern of ENEMY_ATTACK_PATTERN_CATALOG) {
    const plan = planEnemyAttackPattern({ patternId: catalogPattern.id, pressure: 1, seed: 9, origin: { x: 0, y: 0 }, target: { x: 4, y: 0 } });
    const validation = validateDodgePathForPattern(plan, { dashIFrameSeconds: 0.38, playerMoveSpeedTilesPerSecond: 4.15 });
    assert.equal(validation.ok, true, `${plan.patternId}: ${validation.reason}`);
  }
});

test('WO-44 runtime consumes pattern plans for generic roguelike attacks', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes('planEnemyAttackPattern'), 'runtime should import/use the pattern planner');
  assert.ok(main.includes('emitEnemyPatternActions'), 'runtime should translate pattern actions into shots/tells');
});
