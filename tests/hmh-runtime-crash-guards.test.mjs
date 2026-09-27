// Two live-child crashes found by the headless real-run harness (2026-09-25).
// Pixi 8 stops its ticker when a listener throws, so either one froze the game
// until a pause/resume. Both are reproduced here through the real modules and
// the actual main.mjs expressions (parsed out of the source, as in
// hmh-burner-runtime-causality.test.mjs), never through a copy of the glue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { resolveCombatHits } from '../apps/hmh-reboot/src/combat-events.mjs';
import { LIQUIDATOR_BELL_INTRO_TICKS, createLiquidatorBoss, isLiquidatorTargetable } from '../apps/hmh-reboot/src/liquidator-boss.mjs';
import {
  createWeaponLoadout,
  grantWeaponPickup,
  refillWeaponLoadout,
  stepWeaponLoadout,
} from '../apps/hmh-reboot/src/weapon-system.mjs';

const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const nodes = [];
const parents = new Map();
(function walk(node, parent) {
  if (!node || typeof node !== 'object') return;
  if (node.type) { nodes.push(node); parents.set(node, parent); parent = node; }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => walk(child, parent));
    else if (value && typeof value === 'object') walk(value, parent);
  }
})(ast, null);
const text = (node) => source.slice(node.start, node.end);
const declaratorInit = (name) => {
  const matches = nodes.filter((node) => node.type === 'VariableDeclarator' && node.id.name === name);
  assert.equal(matches.length, 1, `main.mjs declares ${name} exactly once`);
  return text(matches[0].init);
};
const bossCombatTargetStatement = (() => {
  const matches = nodes.filter((node) => node.type === 'IfStatement'
    && /^combatTargets\.push\(/.test(text(node.consequent))
    && text(node.consequent).includes('id: liquidatorBoss.id'));
  assert.equal(matches.length, 1, 'main.mjs adds the boss to the combat resolver in one place');
  return text(matches[0]);
})();

// The actual main.mjs expressions, evaluated against real module state.
// Since the boss kit (S1.5) the Liquidator has no start timer: he is null until
// the player starts him, and every weapon, hazard and resolver list reads one
// liveness gate, main.mjs's `bossTargetable`, which is the real
// isLiquidatorTargetable (active, alive, and past the Closing Bell intro).
// The gate is evaluated from main.mjs's own declarator, never re-typed here.
assert.equal(declaratorInit('bossTargetable'), 'isLiquidatorTargetable(liquidatorBoss, tick)');
function mainBossTargetable({ liquidatorBoss, tick }) {
  return vm.runInNewContext(declaratorInit('bossTargetable'), { isLiquidatorTargetable, liquidatorBoss, tick });
}
function mainLightningTargets({ grayboxEnemies, liquidatorBoss, tick }) {
  const bossTargetable = mainBossTargetable({ liquidatorBoss, tick });
  return vm.runInNewContext(declaratorInit('lightningTargets'), { grayboxEnemies, liquidatorBoss, tick, bossTargetable });
}
function mainCombatTargets({ grayboxEnemies, liquidatorBoss, tick }) {
  const combatTargets = grayboxEnemies.filter((enemy) => enemy.active && enemy.health > 0)
    .map(({ id, health, maxHealth }) => ({ id, health, maxHealth, armor: 1, shieldCharges: 0, knockbackResistance: 1 }));
  const bossTargetable = mainBossTargetable({ liquidatorBoss, tick });
  vm.runInNewContext(bossCombatTargetStatement, { combatTargets, liquidatorBoss, tick, bossTargetable });
  combatTargets.push({ id: 'player', health: 100, maxHealth: 100, armor: 1, shieldCharges: 0, knockbackResistance: 1 });
  return combatTargets;
}
const hitIntent = (hit, tick, weaponId) => ({
  id: hit.id, tick, time: 0, targetId: hit.targetId, sourceId: 'player', weaponId,
  damage: hit.damage, criticalChance: 0, criticalMultiplier: 1, armorPiercing: false,
  direction: { x: 1, y: 0 }, knockback: 0, point: { ...hit.point },
});

// The 1.8.4 shape of the crash: a boss object that exists before it is live. On
// this branch that is a Closing Bell start inside its untargetable intro (the
// bell rings at the contract's 36,000 at the earliest; the constructor takes any
// start tick), and "engaged" means past that intro.
const BOSS_START_TICK = 72_000;
const BOSS_MAX_HEALTH = 4_640;
const DORMANT_TICK = 8_300;
const ENGAGED_TICK = BOSS_START_TICK + LIQUIDATOR_BELL_INTRO_TICKS + 60;

// Fire a channel weapon for `ticks` fixed steps with manual aim (the path the
// hunter pilot took), feeding the main.mjs target list, then resolve every
// hit the way main.mjs does: against the main.mjs combat target set.
function fireChannelAtBoss({ weaponId, startTick, ticks, enemyX, bossX }) {
  const liquidatorBoss = createLiquidatorBoss({ id: 'boss-liquidator', x: bossX, y: 0, groundZ: 0, startTick: BOSS_START_TICK, maxHealth: BOSS_MAX_HEALTH, entry: 'bell' });
  const grayboxEnemies = [{ id: 'enemy-0001', x: enemyX, y: 0, groundZ: 0, active: true, health: 5_000, maxHealth: 5_000 }];
  const loadout = createWeaponLoadout({ weaponIds: ['coin-blaster', weaponId], activeWeaponId: weaponId, seed: 0x484d4808 });
  const hits = [];
  for (let tick = startTick; tick < startTick + ticks; tick += 1) {
    const lightningTargets = mainLightningTargets({ grayboxEnemies, liquidatorBoss, tick });
    const frame = stepWeaponLoadout(loadout, {
      tick,
      fire: true,
      direction: { x: 1, y: 0 },
      channelOrigin: { x: 0, y: 0, z: 40 },
      channelTargets: lightningTargets,
      channelProvokesAmbient: true,
      currentEligibleTargetIds: grayboxEnemies.map((enemy) => enemy.id),
      channelLineOfSight: () => true,
    });
    for (const event of frame.events) {
      if (event.type === 'weapon:flame-pulse' || event.type === 'weapon:channel-pulse') {
        hits.push(...event.hits.map((hit) => hitIntent(hit, tick, event.weaponId)));
      }
    }
  }
  const tick = startTick + ticks - 1;
  const resolve = () => resolveCombatHits({
    sessionSeed: 0x484d4808,
    hits,
    targets: mainCombatTargets({ grayboxEnemies, liquidatorBoss, tick }),
  });
  return { hits, resolve };
}

test('Bear Market Burner cannot touch the dormant Liquidator (r19 tick 8306 crash)', () => {
  const { hits, resolve } = fireChannelAtBoss({ weaponId: 'bear-market-burner', startTick: DORMANT_TICK, ticks: 13, enemyX: 120, bossX: 200 });
  assert.ok(hits.length > 0, 'the Burner reached the live enemy in front of the dormant boss');
  let resolution;
  assert.doesNotThrow(() => { resolution = resolve(); }, 'resolveCombatHits must not see a hit on an unknown target');
  assert.deepEqual(hits.filter((hit) => hit.targetId === 'boss-liquidator'), [], 'no Burner hit may name a boss that is not yet a combat target');
  assert.ok(resolution.damageEvents.some((event) => event.targetId === 'enemy-0001'));
});

test('Lightning Ledger cannot chain onto the dormant Liquidator', () => {
  const { hits, resolve } = fireChannelAtBoss({ weaponId: 'lightning-ledger', startTick: DORMANT_TICK, ticks: 13, enemyX: 100, bossX: 300 });
  assert.ok(hits.length > 0, 'the Ledger pulsed on the live enemy');
  let resolution;
  assert.doesNotThrow(() => { resolution = resolve(); }, 'resolveCombatHits must not see a hit on an unknown target');
  assert.deepEqual(hits.filter((hit) => hit.targetId === 'boss-liquidator'), [], 'no arc may jump to a boss that is not yet a combat target');
  assert.ok(resolution.damageEvents.some((event) => event.targetId === 'enemy-0001'));
});

test('an engaged Liquidator is still a Burner and Ledger target and takes the damage', () => {
  for (const [weaponId, enemyX, bossX] of [['bear-market-burner', 120, 200], ['lightning-ledger', 100, 300]]) {
    const { hits, resolve } = fireChannelAtBoss({ weaponId, startTick: ENGAGED_TICK, ticks: 13, enemyX, bossX });
    assert.ok(hits.some((hit) => hit.targetId === 'boss-liquidator'), `${weaponId} reaches the engaged boss`);
    assert.ok(resolve().damageEvents.some((event) => event.targetId === 'boss-liquidator'), `${weaponId} damage lands on the engaged boss`);
  }
});

test('every list the Liquidator joins in main.mjs waits for its start tick', () => {
  const bossId = (node) => node?.type === 'ObjectExpression'
    && node.properties.some((property) => property.key?.name === 'id' && text(property.value) === 'liquidatorBoss.id');
  // The pressure (body separation) list carries him as a body object, not a
  // target: { id: liquidatorBoss.id, kind: 'boss', ... } inside its array.
  const bossBody = (node) => bossId(node) && node.properties.some((property) => property.key?.name === 'kind' && text(property.value) === "'boss'");
  const entries = nodes.filter((node) =>
    (node.type === 'ArrayExpression' && node.elements.some((element) => (element?.type === 'Identifier' && element.name === 'liquidatorBoss') || bossBody(element)))
    || (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.property.name === 'push'
      && node.arguments.some((argument) => text(argument) === 'liquidatorBoss.id' || bossId(argument)
        || (argument.type === 'CallExpression' && argument.arguments.some(bossId)))));
  // A body list may follow an active boss (he pushes the hero during the bell
  // intro, when he is present but not yet a target); every weapon, hazard and
  // resolver list must read main.mjs's liveness gate: bossTargetable, or the
  // real isLiquidatorTargetable it is declared from (the aim list resolves
  // before the declarator and calls it directly).
  const gateFor = (node) => (node.type === 'ArrayExpression' && node.elements.some(bossBody)
    ? /\bliquidatorBoss\?\.active\b/
    : /\bbossTargetable\b|\bisLiquidatorTargetable\(liquidatorBoss, tick\)/);
  const gated = (node) => {
    const gate = gateFor(node);
    for (let child = node, parent = parents.get(node); parent; child = parent, parent = parents.get(parent)) {
      if (/Function/.test(parent.type)) return false;
      const guard = parent.type === 'ConditionalExpression' && child === parent.consequent ? parent.test
        : parent.type === 'IfStatement' && child === parent.consequent ? parent.test
          : parent.type === 'LogicalExpression' && parent.operator === '&&' && child === parent.right ? parent.left
            : null;
      if (guard && gate.test(text(guard))) return true;
    }
    return false;
  };
  // aim, pressure, hurt, melee, hazard, auto-target ids, channel targets, combat resolver
  assert.ok(entries.length >= 8, `found ${entries.length} boss list entries`);
  const ungated = entries.filter((entry) => !gated(entry)).map((entry) => `${source.slice(0, entry.start).split('\n').length}: ${text(entry).slice(0, 80)}`);
  assert.deepEqual(ungated, [], 'a dormant boss must not be offered to any weapon, hazard or resolver list');
});

test('before the player starts him there is no boss object, and no list offers one', () => {
  // S1.5: liquidatorBoss is null until the Closing Bell or the Dark Pool starts
  // him; the same main.mjs expressions must stay safe on null.
  const grayboxEnemies = [{ id: 'enemy-0001', x: 120, y: 0, groundZ: 0, active: true, health: 5_000, maxHealth: 5_000 }];
  for (const tick of [0, DORMANT_TICK, ENGAGED_TICK]) {
    assert.equal(mainBossTargetable({ liquidatorBoss: null, tick }), false);
    // Array.from: the list is built inside the vm realm, and deepEqual compares prototypes.
    assert.deepEqual(Array.from(mainLightningTargets({ grayboxEnemies, liquidatorBoss: null, tick }), (target) => target.id), ['enemy-0001']);
    assert.deepEqual(Array.from(mainCombatTargets({ grayboxEnemies, liquidatorBoss: null, tick }), (target) => target.id), ['enemy-0001', 'player']);
  }
});

// --- Bug 2: an ammo reward landing mid-channel -----------------------------

const LEDGER_TARGETS = [{ id: 'enemy-a', x: 90, y: 0, active: true }];
function channelingLoadout(weaponIds = ['coin-blaster', 'scatter-shotgun', 'lightning-ledger']) {
  const loadout = createWeaponLoadout({ weaponIds, activeWeaponId: 'lightning-ledger', seed: 0x484d4808 });
  grantWeaponPickup(loadout, { tick: 0, weaponId: 'scatter-shotgun', select: false });
  const events = [];
  const step = (tick) => {
    const frame = stepWeaponLoadout(loadout, {
      tick, fire: true, direction: { x: 1, y: 0 }, channelOrigin: { x: 0, y: 0 },
      channelTargets: LEDGER_TARGETS, channelLineOfSight: () => true,
    });
    events.push(...frame.events.map((event) => ({ ...event })));
    return frame;
  };
  assert.equal(step(0).events[0].type, 'ledger:channel-start');
  for (let tick = 1; tick <= 40; tick += 1) step(tick);
  const ledger = loadout.weapons['lightning-ledger'];
  assert.equal(ledger.channelState.active, true);
  assert.equal(ledger.channelState.cellsRemaining, 5, 'one cell drained at tick 30');
  return { loadout, ledger, step, events };
}

function refillMidChannelScenario() {
  const { loadout, ledger, step, events } = channelingLoadout();
  loadout.weapons['scatter-shotgun'].ammoInClip = 0;
  // A destructible ammo supply (or site/secret/crate reward) resolved while the beam is held.
  refillWeaponLoadout(loadout, { tick: 41 });
  const afterRefill = { active: ledger.channelState.active, cells: ledger.channelState.cellsRemaining, clip: ledger.ammoInClip, shotgun: loadout.weapons['scatter-shotgun'].ammoInClip };
  for (let tick = 41; tick <= 200; tick += 1) step(tick);
  return { afterRefill, events };
}

test('an ammo refill mid-channel tops the Ledger up without breaking the beam', () => {
  const { afterRefill, events } = refillMidChannelScenario();
  assert.deepEqual(afterRefill, { active: true, cells: 6, clip: 6, shotgun: afterRefill.shotgun });
  assert.ok(afterRefill.shotgun > 0, 'the other carried weapons are refilled on the same tick');
  const after = events.filter((event) => event.tick > 40);
  assert.equal(after.find((event) => event.type === 'ledger:channel-break'), undefined, 'the refill does not interrupt the channel');
  assert.ok(after.some((event) => event.type === 'weapon:channel-pulse' && event.tick === 42), 'pulses keep their fixed cadence');
  // The overheat cap still ends the channel on its original schedule.
  const overheat = after.find((event) => event.type === 'ledger:overheat');
  assert.equal(overheat?.tick, 180);
  assert.deepEqual(refillMidChannelScenario(), { afterRefill, events }, 'same inputs, same outcome');
});

test('a Ledger cache collected mid-channel tops the cells up without breaking the beam', () => {
  const { loadout, ledger, step, events } = channelingLoadout();
  // main.mjs grants every weapon cache with select: true, which re-arms the
  // six-tick switch lockout even for the weapon already in hand.
  grantWeaponPickup(loadout, { tick: 41, weaponId: 'lightning-ledger', select: true });
  assert.equal(ledger.channelState.active, true);
  assert.equal(ledger.channelState.cellsRemaining, 6);
  for (let tick = 41; tick <= 48; tick += 1) step(tick);
  assert.equal(events.find((event) => event.tick > 40 && event.type === 'ledger:channel-break'), undefined);
  assert.ok(events.some((event) => event.type === 'weapon:channel-pulse' && event.tick === 48), 'the beam resumes after the lockout');
});

test('a refill after a pickup switched away from a live channel does not throw (r21 tick 16409 crash)', () => {
  // The real crash: a Scatter Shotgun cache auto-selected the shotgun mid-beam
  // (tick 14133), which leaves the Ledger channel flagged live, and a
  // destructible ammo supply refilled the loadout at tick 16409.
  const { loadout, ledger } = channelingLoadout();
  grantWeaponPickup(loadout, { tick: 41, weaponId: 'scatter-shotgun', select: true });
  assert.equal(loadout.activeWeaponId, 'scatter-shotgun');
  refillWeaponLoadout(loadout, { tick: 42 });
  assert.equal(ledger.channelState.cellsRemaining, 6);
  assert.equal(ledger.ammoInClip, 6);
});
