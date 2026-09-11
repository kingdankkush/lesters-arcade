import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  HMH_OPENING_ATTACK_GRACE_TICKS,
  HMH_OPENING_ENEMY_ARCHETYPE_IDS,
  HMH_OPENING_ENEMY_HEALTH_BY_ARCHETYPE,
  HMH_OPENING_MOVEMENT_HOLD_TICKS,
  encounterEnemyHealth,
  openingEnemyAttacksEnabled,
  openingEnemyMovementEnabled,
} from '../apps/hmh-reboot/src/opening-balance.mjs';
import { createEnemyState } from '../apps/hmh-reboot/src/enemy-simulation.mjs';
import { createWeaponLoadout, stepWeaponLoadout } from '../apps/hmh-reboot/src/weapon-system.mjs';
import { resolveCombatHits } from '../apps/hmh-reboot/src/combat-events.mjs';

test('default run gives the player a two-second movement read and eight-second attack grace', () => {
  assert.equal(HMH_OPENING_MOVEMENT_HOLD_TICKS, 120);
  assert.equal(HMH_OPENING_ATTACK_GRACE_TICKS, 480);
  assert.deepEqual(HMH_OPENING_ENEMY_ARCHETYPE_IDS, ['bagholder-rusher', 'forkrunner']);
  assert.equal(openingEnemyMovementEnabled(119), false);
  assert.equal(openingEnemyMovementEnabled(120), true);
  assert.equal(openingEnemyAttacksEnabled(479), false);
  assert.equal(openingEnemyAttacksEnabled(480), true);
});

test('health scaling accepts fixed simulation ticks and positive integer health only', () => {
  for (const tick of [-1, 0.5, Infinity, NaN]) assert.throws(() => encounterEnemyHealth('bagholder-rusher', 80, tick), /tick/);
  for (const health of [0, -1, 0.5, Infinity, NaN]) assert.throws(() => encounterEnemyHealth('bagholder-rusher', health, 0), /fullHealth/);
  assert.equal(encounterEnemyHealth('bagholder-rusher', 2, 0), 2, 'never increase a weaker authored enemy');
});

test('both opening enemies fall to one or two unupgraded pistol hits without a critical', () => {
  for (const archetypeId of HMH_OPENING_ENEMY_ARCHETYPE_IDS) {
    let enemy = createEnemyState({ archetypeId, id: archetypeId, x: 100, y: 0 });
    enemy.health = enemy.maxHealth = HMH_OPENING_ENEMY_HEALTH_BY_ARCHETYPE[archetypeId];
    const loadout = createWeaponLoadout({ seed: 42 });
    let shots = 0;
    for (let tick = 1; tick <= 21; tick += 1) {
      const frame = stepWeaponLoadout(loadout, { tick, fire: true, direction: { x: 1, y: 0 } });
      for (const event of frame.events.filter((entry) => entry.type === 'weapon:fire')) {
        if (enemy.health <= 0) break;
        shots += 1;
        const shot = event.shots[0];
        const result = resolveCombatHits({ sessionSeed: 42, targets: [enemy], hits: [{
          id: shot.id, targetId: enemy.id, sourceId: 'hero', weaponId: 'coin-blaster',
          tick, damage: shot.damage, criticalChance: 0,
        }] });
        enemy = result.targets[enemy.id];
      }
    }
    assert.equal(enemy.health, 0, `${archetypeId} survives two real starter-pistol hits`);
    assert.ok(shots >= 1 && shots <= 2, `${archetypeId}: ${shots} hits`);
  }
});

test('reboot runtime gates enemy movement and attacks through opening balance policy', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /!rosterPreviewEnabled && openingEnemyMovementEnabled\(tick\)/);
  assert.match(source, /rosterCombatEnabled = rosterPreviewEnabled && runtimeParams\.get\('rosterCombat'\) === '1'/);
  assert.match(source, /\(!rosterPreviewEnabled \|\| rosterCombatEnabled\) && openingEnemyAttacksEnabled\(tick\)/);
  assert.match(source, /const initialEnemyArchetypeIds = rosterPreviewEnabled \? ENEMY_ARCHETYPE_IDS : HMH_OPENING_ENEMY_ARCHETYPE_IDS/);
  assert.match(source, /initialEnemyArchetypeIds\.map/);
  assert.match(source, /HMH_OPENING_ENEMY_HEALTH_BY_ARCHETYPE\[archetypeId\]/);
});
