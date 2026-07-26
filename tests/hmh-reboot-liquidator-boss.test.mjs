import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  LIQUIDATOR_ATTACK_DEFINITIONS,
  LIQUIDATOR_ATTACK_PLAN,
  LIQUIDATOR_PHASES,
  LIQUIDATOR_READABILITY_BUDGET,
  LIQUIDATOR_TARGET_FIGHT_TICKS,
  MAX_BOSS_EVENTS_PER_TICK,
  applyLiquidatorDamage,
  createLiquidatorBoss,
  resolveLiquidatorAttack,
  simulateLiquidatorDps,
  stepLiquidatorBoss,
} from '../apps/hmh-reboot/src/liquidator-boss.mjs';

const PLAYER = { x: 160, y: 0, groundZ: 0 };

function runTimeline(partition) {
  const boss = createLiquidatorBoss({ id: 'liquidator', x: 0, y: 0, startTick: 0 });
  const events = [];
  let accumulator = 0;
  for (let frame = 0; boss.elapsedTick < LIQUIDATOR_TARGET_FIGHT_TICKS; frame += 1) {
    accumulator += partition;
    while (accumulator >= 1 && boss.elapsedTick < LIQUIDATOR_TARGET_FIGHT_TICKS) {
      const tick = boss.elapsedTick + 1;
      const report = stepLiquidatorBoss({ boss, tick, player: PLAYER });
      events.push(...report.events.map((event) => `${tick}:${event.type}:${event.attackId ?? event.phaseId}`));
      accumulator -= 1;
    }
  }
  return { boss, events };
}

test('Liquidator defines a frozen one-minute three-phase fight with six primitives and two supers', () => {
  assert.equal(LIQUIDATOR_TARGET_FIGHT_TICKS, 3_600);
  assert.deepEqual(LIQUIDATOR_PHASES.map((phase) => [phase.id, phase.minTick, phase.maxTick]), [
    ['market-open', 0, 1_199], ['margin-call', 1_200, 2_399], ['total-liquidation', 2_400, 3_599],
  ]);
  const definitions = Object.values(LIQUIDATOR_ATTACK_DEFINITIONS);
  assert.equal(definitions.filter((entry) => entry.tier === 'primitive').length, 6);
  assert.equal(definitions.filter((entry) => entry.tier === 'super').length, 2);
  for (const definition of definitions) {
    assert.ok(Object.isFrozen(definition));
    assert.ok(definition.tellTicks >= 30);
    assert.ok(definition.telegraph && definition.geometry);
    assert.ok(Number.isInteger(definition.damage) && definition.damage >= 0);
  }
  assert.ok(LIQUIDATOR_ATTACK_PLAN.every((entry, index, list) => index === 0 || entry.startTick > list[index - 1].startTick));
  assert.deepEqual(LIQUIDATOR_READABILITY_BUDGET, { animationLayers: 4, simultaneousTelegraphs: 4, activeEffects: 24, audioVoices: 6, activeAdds: 6 });
  assert.ok(Object.isFrozen(LIQUIDATOR_READABILITY_BUDGET));
});

test('attack order and phase events are identical across 60/30/20 render partitions', () => {
  const a = runTimeline(1);
  const b = runTimeline(2);
  const c = runTimeline(3);
  assert.deepEqual(a.events, b.events);
  assert.deepEqual(a.events, c.events);
  const tells = a.events.filter((event) => event.includes(':tell:'));
  const resolves = a.events.filter((event) => event.includes(':attack:') || event.includes(':add-wave:'));
  assert.equal(tells.length, LIQUIDATOR_ATTACK_PLAN.length);
  assert.equal(resolves.length, LIQUIDATOR_ATTACK_PLAN.length);
  assert.ok(a.events.includes('1200:arena-change:margin-call'));
  assert.ok(a.events.includes('2400:arena-change:total-liquidation'));
  assert.equal(a.boss.droppedEvents, 0);
});

test('locked lane tell does not track a player who dodges after tell start', () => {
  const boss = createLiquidatorBoss({ id: 'liquidator', x: 0, y: 0, startTick: 0 });
  let tell;
  for (let tick = 1; tick <= 60; tick += 1) {
    const report = stepLiquidatorBoss({ boss, tick, player: PLAYER });
    tell = report.events.find((event) => event.type === 'tell') ?? tell;
  }
  assert.equal(tell.attackId, 'crash-lane');
  assert.deepEqual(tell.target, { x: 160, y: 0 });
  let attack;
  for (let tick = 61; tick <= 105; tick += 1) {
    const report = stepLiquidatorBoss({ boss, tick, player: { x: 160, y: 160, groundZ: 0 } });
    attack = report.events.find((event) => event.type === 'attack') ?? attack;
  }
  assert.deepEqual(attack.target, { x: 160, y: 0 });
  assert.equal(resolveLiquidatorAttack({ event: attack, player: { x: 160, y: 160, groundZ: 0 } }).hit, false);
  assert.equal(resolveLiquidatorAttack({ event: attack, player: PLAYER }).hit, true);
});

test('every damaging resolution has visible matching geometry and support adds never damage the player', () => {
  const boss = createLiquidatorBoss({ id: 'liquidator', x: 0, y: 0, startTick: 0 });
  const resolutions = [];
  for (let tick = 1; tick <= 3_600; tick += 1) {
    resolutions.push(...stepLiquidatorBoss({ boss, tick, player: PLAYER }).events.filter((event) => ['attack', 'add-wave'].includes(event.type)));
  }
  assert.ok(resolutions.length > 0);
  for (const event of resolutions) {
    assert.ok(event.telegraphId && event.geometry);
    if (event.type === 'add-wave') {
      assert.equal(event.damage, 0);
      assert.equal(resolveLiquidatorAttack({ event, player: PLAYER }).hit, false);
    } else {
      assert.ok(event.damage > 0);
    }
  }
  assert.ok(resolutions.length <= LIQUIDATOR_ATTACK_PLAN.length);
});

test('super attacks expose strong safe zones and resolve outside rather than inside them', () => {
  const boss = createLiquidatorBoss({ id: 'liquidator', x: 0, y: 0, startTick: 0 });
  let superAttack;
  for (let tick = 1; tick <= 1_380; tick += 1) {
    const report = stepLiquidatorBoss({ boss, tick, player: PLAYER });
    superAttack = report.events.find((event) => event.type === 'attack' && event.attackId === 'circuit-breaker') ?? superAttack;
  }
  assert.equal(superAttack.geometry.type, 'safe-circles');
  const safe = superAttack.geometry.zones[0];
  assert.equal(resolveLiquidatorAttack({ event: superAttack, player: { x: safe.x, y: safe.y, groundZ: 0 } }).hit, false);
  assert.equal(resolveLiquidatorAttack({ event: superAttack, player: { x: 500, y: 500, groundZ: 0 } }).hit, true);
});

test('boss events are bounded and the body contract prevents hard pin traps', () => {
  assert.equal(MAX_BOSS_EVENTS_PER_TICK, 8);
  const boss = createLiquidatorBoss({ id: 'liquidator', x: 0, y: 0, startTick: 0 });
  assert.deepEqual(boss.body, { radius: 56, playerSeparationRadius: 84, maxPressureStep: 4, pinEscapeClearance: 48 });
  for (let tick = 1; tick <= 3_600; tick += 1) {
    assert.ok(stepLiquidatorBoss({ boss, tick, player: PLAYER }).events.length <= MAX_BOSS_EVENTS_PER_TICK);
  }
});

test('damage simulations cover no-hit, normal, high-DPS, and low-DPS one-minute outcomes', () => {
  assert.deepEqual(simulateLiquidatorDps({ damagePerTick: 0 }), { defeated: false, defeatTick: null, remainingHealth: 12_000 });
  assert.deepEqual(simulateLiquidatorDps({ damagePerTick: 20 }), { defeated: true, defeatTick: 600, remainingHealth: 0 });
  assert.deepEqual(simulateLiquidatorDps({ damagePerTick: 4 }), { defeated: true, defeatTick: 3_000, remainingHealth: 0 });
  assert.deepEqual(simulateLiquidatorDps({ damagePerTick: 2 }), { defeated: false, defeatTick: null, remainingHealth: 4_800 });
});

test('boss defeat emits exactly one run-event without score, wallet, or settlement authority', () => {
  const boss = createLiquidatorBoss({ id: 'liquidator', x: 0, y: 0, startTick: 100 });
  assert.equal(applyLiquidatorDamage({ boss, amount: 11_999, tick: 200 }).defeated, false);
  const fatal = applyLiquidatorDamage({ boss, amount: 1, tick: 201 });
  assert.equal(fatal.defeated, true);
  assert.deepEqual(fatal.runEvent, { type: 'game:run-event', name: 'boss-defeated', data: { bossId: 'liquidator', tick: 201, elapsedTicks: 101 } });
  assert.equal('score' in fatal.runEvent.data, false);
  assert.equal('wallet' in fatal.runEvent.data, false);
  assert.equal(applyLiquidatorDamage({ boss, amount: 1, tick: 202 }).runEvent, null);
});

test('runtime routes boss attacks and defeat through canonical combat and run-event boundaries', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(source, /createLiquidatorBoss/);
  assert.match(source, /stepLiquidatorBoss/);
  assert.match(source, /resolveLiquidatorAttack/);
  assert.match(source, /applyLiquidatorDamage/);
  assert.ok(source.indexOf('lastBossStep = stepLiquidatorBoss') < source.indexOf('resolveCombatHits'));
  assert.match(source, /eventType:\s*'boss-defeated'/);
});

test('boss attack plan loops after the authored plan is exhausted instead of going passive', () => {
  const boss = createLiquidatorBoss({ id: 'loop-liquidator', x: 0, y: 0, startTick: 0 });
  let lateDamagingResolutions = 0;
  for (let tick = 1; tick <= 7_200; tick += 1) {
    const report = stepLiquidatorBoss({ boss, tick, player: { x: 0, y: 0, groundZ: 0 } });
    for (const event of report.events) {
      if (event.type === 'attack' && event.damage > 0 && tick > 3_600) lateDamagingResolutions += 1;
    }
  }
  assert.ok(lateDamagingResolutions >= 1, 'boss must keep attacking after the authored plan window');
  assert.equal(boss.health, boss.maxHealth);
});

test('pending boss attacks resolve even when their exact resolve tick was not stepped', () => {
  const boss = createLiquidatorBoss({ id: 'skip-liquidator', x: 0, y: 0, startTick: 0 });
  let resolved = 0;
  for (let tick = 1; tick <= 200; tick += 1) {
    if (tick === 105) continue; // crash-lane resolves at 60 + 45 = 105
    const report = stepLiquidatorBoss({ boss, tick, player: { x: 0, y: 0, groundZ: 0 } });
    resolved += report.events.filter((event) => event.type === 'attack').length;
  }
  assert.ok(resolved >= 1, 'a skipped resolve tick must not strand the telegraph');
  assert.equal(boss.pendingAttacks.length, 0);
});

test('main wires combat damage and score events with fields that actually exist', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.ok(!source.includes('damageEvent.amount'), 'damage events expose damageApplied, not amount');
  assert.ok(source.includes('damageEvent.damageApplied'), 'main must consume damageApplied');
  assert.ok(!source.includes('state.dead'), 'combat target clones expose active/health, never dead');
  const scoreLoop = source.slice(source.indexOf('for (const scoreEvent of'));
  assert.ok(scoreLoop.includes('liquidatorBoss.id'), 'boss defeat must award score/XP/kill credit in the score loop');
});

test('combat damage events drive boss damage end to end', async () => {
  const { resolveCombatHits } = await import('../apps/hmh-reboot/src/combat-events.mjs');
  const boss = createLiquidatorBoss({ id: 'integration-liquidator', x: 0, y: 0, startTick: 0 });
  const resolution = resolveCombatHits({
    sessionSeed: 7,
    hits: [{
      id: 'hit-1', targetId: boss.id, sourceId: 'player', weaponId: 'settler-pistol',
      tick: 5, damage: 40, criticalChance: 0, knockback: 10,
      direction: { x: 1, y: 0 }, point: { x: 0, y: 0, z: 0 },
    }],
    targets: [{ id: boss.id, health: boss.health, maxHealth: boss.maxHealth, armor: 1, shieldCharges: 0, knockbackResistance: 0.92 }],
  });
  const damageEvent = resolution.damageEvents[0];
  assert.ok(Object.hasOwn(damageEvent, 'damageApplied'));
  assert.ok(!Object.hasOwn(damageEvent, 'amount'));
  const outcome = applyLiquidatorDamage({ boss, amount: damageEvent.damageApplied, tick: 5 });
  assert.equal(outcome.defeated, false);
  assert.equal(boss.health, boss.maxHealth - damageEvent.damageApplied);
});
