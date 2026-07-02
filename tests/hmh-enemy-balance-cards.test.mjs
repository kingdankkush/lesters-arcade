import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { LESTER_BLASTER_ENEMY_CATALOG } from '../apps/portal/src/arcade-core.mjs';
import {
  HMH_PLAYER_BASE_MOVE_SPEED_TILES_PER_SECOND,
  buildEnemyBalanceCard,
  buildEnemyBalanceCards,
  validateEnemyBalanceCards,
} from '../apps/portal/src/hmh-combat-balance.mjs';

test('WO-31 builds readable balance cards for every Level 1 enemy catalog entry', () => {
  const cards = buildEnemyBalanceCards(LESTER_BLASTER_ENEMY_CATALOG);
  assert.equal(cards.length, LESTER_BLASTER_ENEMY_CATALOG.length);
  for (const card of cards) {
    assert.ok(card.enemyId, 'card needs stable enemy id');
    assert.ok(['melee', 'ranged', 'flyer', 'stationary', 'boss'].includes(card.role), `${card.enemyId} role ${card.role}`);
    assert.ok(card.speedLaw.catalogSpeed >= 0, `${card.enemyId} catalog speed`);
    assert.ok(card.speedLaw.spawnSpeed >= 0, `${card.enemyId} spawn speed`);
    assert.ok(card.readability.minTellFrames >= 24, `${card.enemyId} should keep readable tell frames`);
    assert.ok(card.readability.recoveryFrames >= 20, `${card.enemyId} should keep readable recovery`);
  }
});

test('WO-31 speed law keeps melee pressure below player escape speed even at late pressure', () => {
  const coyote = buildEnemyBalanceCard({
    enemy: { id: 'coyote-pack-runner', speed: 3.5, preferredRangeMode: 'melee', class: 'pack-ambusher' },
    elite: false,
    pressure: 0.95,
  });
  const eliteRat = buildEnemyBalanceCard({
    enemy: { id: 'rug-rat', speed: 3.3, preferredRangeMode: 'melee', class: 'disruptor' },
    elite: true,
    pressure: 1,
    playerMoveSpeed: HMH_PLAYER_BASE_MOVE_SPEED_TILES_PER_SECOND * 1.12,
  });

  assert.ok(coyote.speedLaw.chaseSpeed <= HMH_PLAYER_BASE_MOVE_SPEED_TILES_PER_SECOND * 0.86, `normal chase ${coyote.speedLaw.chaseSpeed}`);
  assert.ok(eliteRat.speedLaw.chaseSpeed <= HMH_PLAYER_BASE_MOVE_SPEED_TILES_PER_SECOND * 1.12 * 0.92, `elite chase ${eliteRat.speedLaw.chaseSpeed}`);
  assert.ok(eliteRat.readability.minTellFrames >= 28, 'elite melee still needs tell frames');
});

test('WO-31 stationary and boss-class balance cards do not inherit melee chase behavior', () => {
  const turret = buildEnemyBalanceCard({ enemy: { id: 'honeypot-turret', speed: 0, preferredRangeMode: 'ranged', class: 'stationary-trap' }, pressure: 1 });
  const boss = buildEnemyBalanceCard({ enemy: { id: 'rug-pull-baron', speed: 1.1, boss: true, preferredRangeMode: 'ranged', class: 'boss' }, boss: true, pressure: 1 });

  assert.equal(turret.role, 'stationary');
  assert.equal(turret.speedLaw.chaseSpeed, 0);
  assert.equal(boss.role, 'boss');
  assert.ok(boss.speedLaw.spawnSpeed <= 1.1, 'boss movement should stay deliberate');
  assert.ok(boss.readability.minTellFrames >= 42, 'bosses need larger tells');
});

test('WO-31 validation catches speed-law violations and passes the live catalog', () => {
  const ok = validateEnemyBalanceCards(buildEnemyBalanceCards(LESTER_BLASTER_ENEMY_CATALOG));
  assert.equal(ok.ok, true, ok.errors.join('\n'));

  const broken = validateEnemyBalanceCards([
    buildEnemyBalanceCard({ enemy: { id: 'too-fast', speed: 8, preferredRangeMode: 'melee', class: 'rusher' }, pressure: 1 }),
  ].map((card) => ({ ...card, speedLaw: { ...card.speedLaw, chaseSpeed: HMH_PLAYER_BASE_MOVE_SPEED_TILES_PER_SECOND * 1.2 } })));
  assert.equal(broken.ok, false);
  assert.ok(broken.errors.some((error) => error.includes('too-fast')));
});

test('WO-31 runtime spawns enemies from balance cards and still routes live chase through the speed law', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes('buildEnemyBalanceCard'), 'main.js should import/use enemy balance cards');
  assert.ok(main.includes('balanceCard.speedLaw.spawnSpeed'), 'spawn speed should come from card speed law');
  assert.ok(main.includes('calculateEnemyChaseSpeed({'), 'movement should continue using speed law helper');
});
