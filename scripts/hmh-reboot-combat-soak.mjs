import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { resolveCombatHits } from '../apps/hmh-reboot/src/combat-events.mjs';
import { createMeleeState, createMeleeTarget, stepMeleeState } from '../apps/hmh-reboot/src/melee.mjs';
import { createGrenadeSystem, stepGrenadeSystem, throwGrenade } from '../apps/hmh-reboot/src/grenades.mjs';
import { DeterministicSimulation } from '../apps/hmh-reboot/src/simulation.mjs';
import {
  HMH_WEAPON_DEFINITIONS,
  createWeaponLoadout,
  getActiveWeaponState,
  stepWeaponLoadout,
} from '../apps/hmh-reboot/src/weapon-system.mjs';

const MINUTE_TICKS = 60 * 60;
const direction = Object.freeze({ x: 1, y: 0 });
const flatGround = (x, y) => ({ x, y, groundZ: 0, surfaceId: 'foundation', visibleTerrainId: 'graybox-foundation' });
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function weaponMinute(weaponId, seed) {
  const state = createWeaponLoadout({ weaponIds: [weaponId], activeWeaponId: weaponId, seed });
  const report = { weaponId, fireEvents: 0, projectiles: 0, reloadStarts: 0, reloadCompletes: 0, minAmmo: Infinity, maxAmmo: 0 };
  for (let tick = 1; tick <= MINUTE_TICKS; tick += 1) {
    const frame = stepWeaponLoadout(state, { tick, fire: true, direction });
    for (const event of frame.events) {
      if (event.type === 'weapon:fire') {
        report.fireEvents += 1;
        report.projectiles += event.shots.length;
      } else if (event.type === 'weapon:reload-start') report.reloadStarts += 1;
      else if (event.type === 'weapon:reload-complete') report.reloadCompletes += 1;
    }
    const ammo = getActiveWeaponState(state).ammoInClip;
    report.minAmmo = Math.min(report.minAmmo, ammo);
    report.maxAmmo = Math.max(report.maxAmmo, ammo);
  }
  report.finalAmmo = getActiveWeaponState(state).ammoInClip;
  report.reloadPending = getActiveWeaponState(state).reloadCompleteTick !== null;
  report.stateHash = hash(state);
  assert.ok(report.fireEvents > 0, `${weaponId} never fired`);
  assert.ok(report.minAmmo >= 0);
  assert.ok(report.maxAmmo <= HMH_WEAPON_DEFINITIONS[weaponId].clipSize);
  return report;
}

function weaponTimeToKill(weaponId, seed, targetHealth = 120) {
  const state = createWeaponLoadout({ weaponIds: [weaponId], activeWeaponId: weaponId, seed });
  let health = targetHealth;
  let damageEvents = 0;
  for (let tick = 1; tick <= MINUTE_TICKS; tick += 1) {
    const frame = stepWeaponLoadout(state, { tick, fire: true, direction });
    for (const event of frame.events) {
      if (event.type !== 'weapon:fire') continue;
      health = Math.max(0, health - event.shots.reduce((total, shot) => total + shot.damage, 0));
      damageEvents += 1;
      if (health === 0) return { weaponId, targetHealth, killTick: tick, damageEvents };
    }
  }
  throw new Error(`${weaponId} failed to defeat a ${targetHealth} HP target within one minute`);
}

function meleeMinute() {
  const state = createMeleeState();
  const target = createMeleeTarget({
    id: 'soak-target',
    previousGround: { x: 40, y: 0, z: 0 },
    currentGround: { x: 40, y: 0, z: 0 },
    radius: 6,
  });
  let attacks = 0;
  let hits = 0;
  for (let tick = 1; tick <= MINUTE_TICKS; tick += 1) {
    const frame = stepMeleeState(state, {
      tick,
      trigger: true,
      origin: { x: 0, y: 0 },
      sourceGroundZ: 0,
      direction,
      targets: [target],
    });
    attacks += Number(frame.attacked);
    hits += frame.hits.length;
  }
  assert.equal(attacks, 180);
  assert.equal(hits, attacks);
  return { attacks, hits, stateHash: hash(state) };
}

function grenadeMinute() {
  const system = createGrenadeSystem({ capacity: 16, handCharges: 500 });
  for (let index = 0; index < 20; index += 1) {
    throwGrenade(system, { tick: 0, mode: index % 2 === 0 ? 'hand' : 'launcher', origin: { x: 0, y: index * 3, z: 24 }, direction });
  }
  let maxActive = system.active.length;
  let detonations = 0;
  let bounces = 0;
  for (let tick = 1; tick <= MINUTE_TICKS; tick += 1) {
    if (tick % 90 === 0) {
      throwGrenade(system, { tick, mode: tick % 180 === 0 ? 'hand' : 'launcher', origin: { x: 0, y: 0, z: 24 }, direction });
    }
    const frame = stepGrenadeSystem(system, { tick, queryGround: flatGround });
    maxActive = Math.max(maxActive, frame.activeCount);
    detonations += frame.detonations.length;
    bounces += frame.bounces.length;
    assert.ok(frame.activeCount <= system.capacity);
  }
  assert.equal(maxActive, 16);
  assert.equal(system.droppedSpawns, 4);
  assert.ok(detonations > 0);
  assert.ok(bounces > 0);
  return {
    maxActive,
    droppedSpawns: system.droppedSpawns,
    detonations,
    bounces,
    finalActive: system.active.length,
    finalHandCharges: system.handCharges,
    stateHash: hash(system),
  };
}

function combatReduction() {
  const targets = Array.from({ length: 150 }, (_, index) => ({
    id: `target-${String(index).padStart(3, '0')}`,
    health: 1000,
    maxHealth: 1000,
    armor: index % 3 === 0 ? 2 : 1,
    shieldCharges: index % 11 === 0 ? 1 : 0,
    knockbackResistance: 1,
  }));
  const hits = targets.map((target, index) => ({
    id: `hit-${String(index).padStart(3, '0')}`,
    tick: index % 60,
    time: index / targets.length,
    targetId: target.id,
    sourceId: 'player',
    weaponId: index % 2 === 0 ? 'coin-blaster' : 'auto-miner',
    damage: 3 + index % 7,
    criticalChance: 0.08,
    direction,
    knockback: 8,
    point: { x: index, y: index % 17, z: 32 },
  }));
  const result = resolveCombatHits({ sessionSeed: 0x8f31d2a7, hits, targets });
  assert.equal(result.damageEvents.length, 150);
  assert.equal(result.scoreEvents.length, 0);
  assert.ok(result.damageEvents.some((event) => event.shielded));
  return {
    damageEvents: result.damageEvents.length,
    shielded: result.damageEvents.filter((event) => event.shielded).length,
    criticals: result.damageEvents.filter((event) => event.critical).length,
    resultHash: hash(result),
  };
}

function replayAtFrameMs(frameMs) {
  const loadout = createWeaponLoadout({ weaponIds: ['auto-miner'], activeWeaponId: 'auto-miner', seed: 0x51a7 });
  let fireEvents = 0;
  const simulation = new DeterministicSimulation({ seed: 0x51a7 });
  simulation.onStep(({ tick }) => {
    const frame = stepWeaponLoadout(loadout, { tick, fire: true, direction });
    fireEvents += frame.events.filter((event) => event.type === 'weapon:fire').length;
  });
  simulation.start();
  while (simulation.tick < MINUTE_TICKS) simulation.update(frameMs, {});
  assert.equal(simulation.tick, MINUTE_TICKS);
  return {
    tick: simulation.tick,
    timeMs: simulation.timeMs,
    fireEvents,
    weapon: getActiveWeaponState(loadout),
    droppedTimeMs: simulation.getLossMetrics().totalDroppedMs,
  };
}

function catchupCap() {
  let steps = 0;
  const simulation = new DeterministicSimulation({ seed: 7 });
  simulation.onStep(() => { steps += 1; });
  simulation.start();
  simulation.update(0, {});
  const frame = simulation.update(250, {});
  assert.equal(frame.steps, 4);
  assert.equal(steps, 4);
  const droppedTimeMs = simulation.getLossMetrics().totalDroppedMs;
  assert.ok(droppedTimeMs > 0);
  return { steps: frame.steps, droppedTimeMs };
}

function runDeterministicScenario() {
  const weapons = Object.keys(HMH_WEAPON_DEFINITIONS).sort().map((weaponId, index) => weaponMinute(weaponId, 0x8f31d2a7 + index));
  const timeToKill = Object.keys(HMH_WEAPON_DEFINITIONS).sort().map((weaponId, index) => weaponTimeToKill(weaponId, 0x51a700 + index));
  const replay60 = replayAtFrameMs(1000 / 60);
  const replay30 = replayAtFrameMs(1000 / 30);
  const replay20 = replayAtFrameMs(1000 / 20);
  assert.deepEqual(replay30, replay60);
  assert.deepEqual(replay20, replay60);
  return {
    minuteTicks: MINUTE_TICKS,
    weapons,
    timeToKill,
    melee: meleeMinute(),
    grenades: grenadeMinute(),
    combat: combatReduction(),
    replay: { fps60: replay60, fps30: replay30, fps20: replay20 },
    catchupCap: catchupCap(),
  };
}

if (global.gc) global.gc();
const heapBefore = process.memoryUsage().heapUsed;
const startedAt = performance.now();
const first = runDeterministicScenario();
const elapsedMs = performance.now() - startedAt;
if (global.gc) global.gc();
const heapAfter = process.memoryUsage().heapUsed;
const second = runDeterministicScenario();
assert.deepEqual(second, first);
const report = {
  ...first,
  repeatHash: hash(first),
  elapsedMs: Number(elapsedMs.toFixed(3)),
  heapBefore,
  heapAfter,
  heapDelta: heapAfter - heapBefore,
  gcExposed: Boolean(global.gc),
};
console.log(JSON.stringify(report, null, 2));
