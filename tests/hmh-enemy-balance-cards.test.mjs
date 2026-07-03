import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { LESTER_BLASTER_ENEMY_CATALOG } from '../apps/portal/src/arcade-core.mjs';
import {
  HMH_PLAYER_BASE_MOVE_SPEED_TILES_PER_SECOND,
  ELITE_AFFIX_CATALOG,
  buildEnemyBalanceCard,
  buildEnemyBalanceCards,
  resolveEliteAffixes,
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

test('WO-43 elite affix catalog documents tells, counterplay, and non-HP behavior modifiers', () => {
  const required = new Set(['shielded', 'splitter', 'volatile', 'magnetron', 'warder', 'vampiric', 'juggernaut']);
  assert.equal(ELITE_AFFIX_CATALOG.length, required.size);
  for (const affix of ELITE_AFFIX_CATALOG) {
    required.delete(affix.id);
    assert.ok(affix.nameplateTag, `${affix.id} needs a nameplate tag`);
    assert.ok(affix.visualTell, `${affix.id} needs a visual tell`);
    assert.ok(Array.isArray(affix.counterplay) && affix.counterplay.length >= 1, `${affix.id} needs counterplay`);
    assert.equal(Object.hasOwn(affix.modifiers ?? {}, 'healthMultiplier'), false, `${affix.id} must not add HP inflation`);
    assert.equal(Object.hasOwn(affix.modifiers ?? {}, 'rawHp'), false, `${affix.id} must not add raw HP`);
  }
  assert.deepEqual([...required], []);
});

test('WO-43 elite affix rolls are seeded, pressure-gated, and never raw HP buffs', () => {
  const earlyA = resolveEliteAffixes({ enemyId: 'evil-banker-ranged', elite: true, pressure: 0.45, seed: 100 });
  const earlyB = resolveEliteAffixes({ enemyId: 'evil-banker-ranged', elite: true, pressure: 0.45, seed: 100 });
  const late = resolveEliteAffixes({ enemyId: 'evil-banker-ranged', elite: true, pressure: 0.75, seed: 100 });
  const grunt = resolveEliteAffixes({ enemyId: 'evil-banker-ranged', elite: false, pressure: 1, seed: 100 });

  assert.deepEqual(earlyA, earlyB);
  assert.equal(earlyA.length, 1);
  assert.equal(late.length, 2, 'above pressure 0.7 elites should roll two affixes');
  assert.equal(new Set(late.map((affix) => affix.id)).size, late.length, 'affixes should not duplicate on one elite');
  assert.equal(grunt.length, 0, 'non-elites should not roll affixes');
  assert.ok(late.every((affix) => !('healthMultiplier' in (affix.modifiers ?? {}))));
});

test('WO-43 balance cards expose affix weights and validation rejects HP-sponge affixes', () => {
  const card = buildEnemyBalanceCard({
    enemy: { id: 'evil-banker-ranged', speed: 2.1, preferredRangeMode: 'ranged', class: 'ranged' },
    elite: true,
    pressure: 0.85,
  });
  assert.ok(card.affixWeightByPressure.shielded > 0);
  assert.ok(card.affixWeightByPressure.volatile > 0);
  const ok = validateEnemyBalanceCards([card]);
  assert.equal(ok.ok, true, ok.errors.join('\n'));

  const broken = validateEnemyBalanceCards([{ ...card, affixWeightByPressure: { ...card.affixWeightByPressure }, affixes: [{ id: 'sponge', modifiers: { healthMultiplier: 2 } }] }]);
  assert.equal(broken.ok, false);
  assert.ok(broken.errors.some((error) => error.includes('HP')));
});

test('WO-43 runtime assigns affix metadata to elite roguelike enemies', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes('resolveEliteAffixes'), 'runtime should roll elite affixes through the balance helper');
  assert.ok(main.includes('affixIds'), 'runtime enemy object should expose compact affix ids');
  assert.ok(main.includes('nameplateTags'), 'runtime enemy object should expose readable nameplate tags');
});
