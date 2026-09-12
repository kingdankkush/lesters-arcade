import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import { ENEMY_ARCHETYPE_IDS, ENEMY_ARCHETYPES } from '../apps/hmh-reboot/src/enemy-archetypes.mjs';
import {
  ENEMY_STRIKE_TICKS,
  ENEMY_TELL_STAGGER_TICKS,
  resolveEnemyAttackAgainstPlayer,
  stepEnemyAttacks,
} from '../apps/hmh-reboot/src/enemy-combat.mjs';
import {
  ENEMY_CAPACITY,
  createEnemyPopulation,
  createEnemyState,
  stepEnemyPopulation,
} from '../apps/hmh-reboot/src/enemy-simulation.mjs';
import { createAuthoredGroundQuery, createElevationSurface } from '../apps/hmh-reboot/src/elevation.mjs';
import { DeterministicSimulation, FIXED_STEP_MS } from '../apps/hmh-reboot/src/simulation.mjs';

// ---------------------------------------------------------------------------
// Tell-to-hit, measured. Until now only bagholder-rusher was stepped through
// the real attack function; the other five archetypes were bounded by
// constants or asserted against the enemy's own attackPhaseUntilTick. Every
// number below is read back from stepEnemyAttacks itself, so the roadmap's
// timing requirement rests on the state machine and not on the data table.
// ---------------------------------------------------------------------------

const MAX_TICKS = 400;
// Whole milliseconds at 60 Hz; 15 ticks is 250 ms, not 250.00000000000003.
const tellToHitMs = (ticks) => Math.round(ticks * 1000 / 60);

// The documented table. tellToHitMs is the readable window the player gets
// between the tell starting and the strike resolving.
export const ENEMY_TELL_TO_HIT_TABLE = Object.freeze([
  Object.freeze({ archetypeId: 'bagholder-rusher', tellTicks: 15, tellToHitMs: 250, strikeTicks: 6, recoveryTicks: 24, cycleTicks: 39 }),
  Object.freeze({ archetypeId: 'forkrunner', tellTicks: 12, tellToHitMs: 200, strikeTicks: 6, recoveryTicks: 20, cycleTicks: 32 }),
  Object.freeze({ archetypeId: 'liquidator-agent', tellTicks: 24, tellToHitMs: 400, strikeTicks: 6, recoveryTicks: 42, cycleTicks: 66 }),
  Object.freeze({ archetypeId: 'whale-enforcer', tellTicks: 30, tellToHitMs: 500, strikeTicks: 6, recoveryTicks: 54, cycleTicks: 84 }),
  Object.freeze({ archetypeId: 'gas-bomber', tellTicks: 36, tellToHitMs: 600, strikeTicks: 6, recoveryTicks: 60, cycleTicks: 96 }),
  Object.freeze({ archetypeId: 'validator-cultist', tellTicks: 45, tellToHitMs: 750, strikeTicks: 6, recoveryTicks: 72, cycleTicks: 117 }),
]);

const player = Object.freeze({ id: 'player', x: 0, y: 0, groundZ: 0, radius: 24 });

function insideRange(archetypeId, origin = player) {
  const archetype = ENEMY_ARCHETYPES[archetypeId];
  return createEnemyState({
    archetypeId,
    id: `measure-${archetypeId}`,
    x: origin.x + archetype.attack.range - 1,
    y: origin.y,
    groundZ: 0,
    visualMode: 'prototype',
  });
}

// Records one tell -> strike -> recovery -> ready cycle. `observe` is called
// once per tick after the attack step so the caller can add its own probes.
function createCycleRecorder(enemy) {
  const cycle = {
    tellStartTick: null,
    strikeTick: null,
    strikeEvent: null,
    attackTicks: 0,
    recoveryTicks: 0,
    readyTick: null,
  };
  return {
    cycle,
    observe(tick, report) {
      if (cycle.tellStartTick === null && enemy.attackPhase === 'tell') cycle.tellStartTick = tick;
      if (cycle.strikeTick === null && report.events.length > 0) {
        cycle.strikeTick = report.events[0].tick;
        cycle.strikeEvent = report.events[0];
      }
      // The strike tick itself is the first strike-pose tick, so it is
      // counted below like every later tick of the cycle.
      if (cycle.strikeTick === null || cycle.readyTick !== null) return;
      // A body that returns to ready inside its own range starts its next
      // tell on that same tick, so the ready tick is visible either as the
      // ready phase or as a fresh tell stamped with this tick.
      if (enemy.attackPhase === 'ready' || (enemy.attackPhase === 'tell' && enemy.attackTellStartedTick === tick)) {
        cycle.readyTick = tick;
      } else if (enemy.attackPhase === 'attack') {
        cycle.attackTicks += 1;
      } else if (enemy.attackPhase === 'recovery') {
        cycle.recoveryTicks += 1;
      }
    },
  };
}

function assertMeasuredCycle(archetypeId, cycle) {
  const archetype = ENEMY_ARCHETYPES[archetypeId];
  const expected = ENEMY_TELL_TO_HIT_TABLE.find((row) => row.archetypeId === archetypeId);
  assert.ok(expected, `${archetypeId} is missing from the documented table`);
  assert.equal(cycle.tellStartTick, 1, `${archetypeId}: a body inside range tells on its first step`);
  assert.ok(Number.isInteger(cycle.strikeTick), `${archetypeId}: no strike resolved`);
  assert.ok(Number.isInteger(cycle.readyTick), `${archetypeId}: never returned to ready`);
  assert.equal(cycle.strikeTick - cycle.tellStartTick, archetype.attack.tellTicks, `${archetypeId}: tell-to-strike`);
  assert.equal(cycle.strikeTick - cycle.tellStartTick, expected.tellTicks, `${archetypeId}: documented tell`);
  assert.equal(cycle.attackTicks, Math.min(ENEMY_STRIKE_TICKS, archetype.attack.recoveryTicks), `${archetypeId}: strike pose length`);
  assert.equal(cycle.attackTicks, expected.strikeTicks);
  assert.equal(cycle.readyTick - cycle.strikeTick, archetype.attack.recoveryTicks, `${archetypeId}: strike-to-ready`);
  assert.equal(cycle.readyTick - cycle.strikeTick, expected.recoveryTicks);
  assert.equal(cycle.attackTicks + cycle.recoveryTicks, archetype.attack.recoveryTicks, `${archetypeId}: the strike is carved out of recovery`);
  assert.equal(cycle.readyTick - cycle.tellStartTick, expected.cycleTicks, `${archetypeId}: full cycle`);
  assert.equal(expected.tellToHitMs, tellToHitMs(expected.tellTicks), `${archetypeId}: ms column`);
  assert.equal(cycle.strikeEvent.tellStartedTick, cycle.tellStartTick, `${archetypeId}: the event carries its tell start`);
  assert.equal(cycle.strikeEvent.archetypeId, archetypeId);
  assert.ok(expected.tellTicks >= 12, `${archetypeId}: readability floor is 12 ticks (200 ms)`);
}

test('every archetype tell-to-strike, strike, and recovery length is measured from the real attack step', () => {
  const measured = [];
  for (const archetypeId of ENEMY_ARCHETYPE_IDS) {
    const enemy = insideRange(archetypeId);
    const recorder = createCycleRecorder(enemy);
    for (let tick = 1; tick <= MAX_TICKS; tick += 1) {
      recorder.observe(tick, stepEnemyAttacks({ enemies: [enemy], player, tick }));
    }
    const { cycle } = recorder;
    assertMeasuredCycle(archetypeId, cycle);
    const resolved = resolveEnemyAttackAgainstPlayer(cycle.strikeEvent, { player });
    if (ENEMY_ARCHETYPES[archetypeId].attack.damage > 0) {
      assert.equal(resolved.hit, true, `${archetypeId}: a player standing on the locked target is hit`);
      assert.equal(resolved.damage, ENEMY_ARCHETYPES[archetypeId].attack.damage);
    } else {
      assert.equal(resolved.reason, 'non-damaging', `${archetypeId}: support pulses never damage`);
    }
    measured.push(Object.freeze({
      archetypeId,
      tellTicks: cycle.strikeTick - cycle.tellStartTick,
      tellToHitMs: tellToHitMs(cycle.strikeTick - cycle.tellStartTick),
      strikeTicks: cycle.attackTicks,
      recoveryTicks: cycle.readyTick - cycle.strikeTick,
      cycleTicks: cycle.readyTick - cycle.tellStartTick,
    }));
  }
  assert.deepEqual(measured, [...ENEMY_TELL_TO_HIT_TABLE], 'the documented table is the measured table');
  assert.equal(ENEMY_TELL_TO_HIT_TABLE.length, ENEMY_ARCHETYPE_IDS.length);
});

// ---------------------------------------------------------------------------
// Integrated: the same cycle through the deterministic simulation with the
// movement step in front of the attack step, exactly as the runtime and the
// enemy soak order them. One simulation per archetype so no same-tick tell
// stagger is folded into the numbers; the stagger has its own test below.
// ---------------------------------------------------------------------------

const WORLD_BOUNDS = Object.freeze({ minX: 0, minY: 0, maxX: 4096, maxY: 4096, visibleBoundaryId: 'timing-visible-edge' });
const FLAT = createElevationSurface({
  id: 'timing-ground', kind: 'ground', area: { type: 'rect', ...WORLD_BOUNDS }, groundZ: 0,
  visibleTerrainId: 'timing-visible-ground', priority: 0,
});
const queryGround = createAuthoredGroundQuery({ baseSurface: FLAT });
const worldPlayer = Object.freeze({ id: 'player', x: 2048, y: 2048, groundZ: 0, radius: 24 });

test('the integrated simulation reproduces the measured table and holds every body still through its tell', () => {
  for (const archetypeId of ENEMY_ARCHETYPE_IDS) {
    const population = createEnemyPopulation({ capacity: ENEMY_CAPACITY, threatCapacity: 4096 });
    const enemy = insideRange(archetypeId, worldPlayer);
    population.active = [enemy];
    population.activeThreat = ENEMY_ARCHETYPES[archetypeId].costs.threat;
    population.insertedCount = 1;
    const recorder = createCycleRecorder(enemy);
    const { cycle } = recorder;
    let tellAnchor = null;
    let displacementDuringTell = 0;
    const simulation = new DeterministicSimulation({ seed: 0x14e11e5 });
    simulation.start();
    simulation.onStep(({ tick, dtSeconds }) => {
      stepEnemyPopulation({
        population,
        player: worldPlayer,
        tick,
        dtSeconds,
        blockers: [],
        bounds: WORLD_BOUNDS,
        queryGround,
      });
      // Movement ran first: a body in its tell must not have moved, and the
      // strike tick itself is still inside the lock.
      if (tellAnchor && cycle.strikeTick === null) {
        displacementDuringTell = Math.max(displacementDuringTell, Math.hypot(enemy.x - tellAnchor.x, enemy.y - tellAnchor.y));
      }
      const report = stepEnemyAttacks({ enemies: population.active, player: worldPlayer, tick });
      recorder.observe(tick, report);
      if (tellAnchor === null && cycle.tellStartTick === tick) tellAnchor = { x: enemy.x, y: enemy.y };
    });
    while (simulation.tick < MAX_TICKS) simulation.update(FIXED_STEP_MS, { move: { x: 0, y: 0 } });
    assertMeasuredCycle(archetypeId, cycle);
    assert.ok(tellAnchor, `${archetypeId}: the tell anchor was never captured`);
    assert.equal(displacementDuringTell, 0, `${archetypeId}: moved ${displacementDuringTell}px during its tell`);
    assert.deepEqual(cycle.strikeEvent.origin, { x: tellAnchor.x, y: tellAnchor.y, groundZ: 0 }, `${archetypeId}: the strike fires from where the tell started`);
  }
});

test('three same-tick melee tells resolve at tellTicks, +9 and +18', () => {
  const attackers = [
    createEnemyState({ archetypeId: 'bagholder-rusher', id: 'rusher-a', x: 60, y: 0, groundZ: 0, visualMode: 'prototype' }),
    createEnemyState({ archetypeId: 'bagholder-rusher', id: 'rusher-b', x: -60, y: 0, groundZ: 0, visualMode: 'prototype' }),
    createEnemyState({ archetypeId: 'bagholder-rusher', id: 'rusher-c', x: 0, y: 60, groundZ: 0, visualMode: 'prototype' }),
  ];
  const tellTicks = ENEMY_ARCHETYPES['bagholder-rusher'].attack.tellTicks;
  const strikes = [];
  for (let tick = 1; tick <= 60 && strikes.length < 3; tick += 1) {
    const report = stepEnemyAttacks({ enemies: attackers, player, tick, budgets: { melee: 3, ranged: 2, area: 1, support: 1 } });
    if (tick === 1) {
      for (const attacker of attackers) {
        assert.equal(attacker.attackPhase, 'tell', `${attacker.id} tells on the first tick`);
        assert.equal(attacker.attackTellStartedTick, 1);
      }
    }
    for (const event of report.events) strikes.push({ tick, enemyId: event.enemyId, tellStartedTick: event.tellStartedTick });
  }
  assert.deepEqual(strikes.map((strike) => strike.tick - strike.tellStartedTick), [tellTicks, tellTicks + ENEMY_TELL_STAGGER_TICKS, tellTicks + 2 * ENEMY_TELL_STAGGER_TICKS]);
  assert.deepEqual(strikes.map((strike) => strike.tick), [1 + tellTicks, 1 + tellTicks + 9, 1 + tellTicks + 18]);
  assert.deepEqual(strikes.map((strike) => strike.enemyId), ['rusher-a', 'rusher-b', 'rusher-c'], 'stagger order follows the canonical id order');
});

test('the authored roster clip cadence fits inside every measured window', async () => {
  const roster = JSON.parse(await readFile(new URL('../apps/hmh-reboot/assets/source/blender/hmh-enemy-roster.json', import.meta.url), 'utf8'));
  const { clips } = roster;
  assert.deepEqual({ tell: clips.tell, attack: clips.attack, hit: clips.hit }, {
    tell: { frames: 2, fps: 6 },
    attack: { frames: 3, fps: 14 },
    hit: { frames: 2, fps: 12 },
  }, 'the cadence this test was measured against');
  for (const row of ENEMY_TELL_TO_HIT_TABLE) {
    // The held tell frame must be on screen before the strike lands, or the
    // tell is only ever its anticipation pose.
    const lastTellFrameReachedAt = Math.floor((row.tellTicks - 1) * clips.tell.fps / 60);
    assert.ok(lastTellFrameReachedAt >= clips.tell.frames - 1, `${row.archetypeId}: tell clip never reaches its held frame`);
    // The exposed final attack frame must arrive inside recovery so the
    // punish window has a pose of its own.
    assert.ok(Math.floor(row.recoveryTicks * clips.attack.fps / 60) >= 2, `${row.archetypeId}: attack clip never reaches its exposed frame`);
    // Both hit frames fit in the six-tick hit window the runtime pins.
    assert.ok(Math.floor((6 - 1) * clips.hit.fps / 60) >= clips.hit.frames - 1, `${row.archetypeId}: hit clip never reaches its recovery frame`);
  }
});

test('the runtime publishes the measured tell-to-strike and the zoom it was read at under release telemetry', async () => {
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  const telemetryStart = source.indexOf('dataset.enemyTells = String(enemyTellCount);');
  assert.ok(telemetryStart >= 0);
  const block = source.slice(telemetryStart, telemetryStart + 800);
  assert.match(block, /dataset\.enemyTellToStrikeTicks = String\(lastEnemyStrike \? lastEnemyStrike\.tick - lastEnemyStrike\.tellStartedTick : ''\)/);
  assert.match(block, /dataset\.enemyTellToStrikeArchetype = lastEnemyStrike\?\.archetypeId \?\? ''/);
  assert.match(block, /dataset\.cameraZoom = /);
  // The strike is remembered from the authoritative event loop and reset with
  // the run; only the dataset write is gated on telemetry.
  assert.match(source, /^\s*lastEnemyStrike = event;$/m);
  assert.match(source, /lastEnemyStrike = null;/);
  assert.ok(source.indexOf('for (const event of lastEnemyAttack.events) {') < source.indexOf('lastEnemyStrike = event;'));
  assert.ok(source.lastIndexOf('if (releaseTelemetryEnabled) {', telemetryStart) >= 0);
});

// The browser gate must assert the frame its predicate accepted. The page
// keeps stepping between CDP round trips and a staggered strike (+9 ticks
// per extra same-tick tell) overwrites lastEnemyStrike, so a second read of
// the dataset can disagree with the predicate. The predicate therefore
// returns the sample (or null) and the script asserts on that handle.
const smokeUrl = new URL('../scripts/hmh-reboot-enemy-boss-presentation-browser-smoke.mjs', import.meta.url);

test('the boss presentation smoke samples tell-to-strike from the frame its predicate accepted', async () => {
  const smoke = await readFile(smokeUrl, 'utf8');
  const waitStart = smoke.indexOf('const timingHandle = await page.waitForFunction((tellTicks) => {');
  assert.ok(waitStart >= 0, 'the predicate is awaited as a handle');
  const predicateStart = smoke.indexOf('(tellTicks) => {', waitStart);
  const predicateEnd = smoke.indexOf('}, TELL_TICKS_BY_ARCHETYPE, { timeout: 20_000 });', predicateStart);
  assert.ok(predicateEnd > predicateStart);
  assert.match(smoke.slice(predicateEnd, predicateEnd + 200), /const timing = await timingHandle\.jsonValue\(\);/, 'the asserted sample is the handle the predicate resolved with');
  assert.equal(smoke.match(/dataset\.enemyTellToStrikeTicks/g).length, 1, 'the dataset is read only inside the predicate; no second evaluate');
  assert.equal(smoke.match(/dataset\.cameraZoom/g).length, 1);
  assert.equal(smoke.match(/dataset\.enemyTellToStrikeArchetype/g).length, 2, 'archetype read once for the match and once for the sample');

  // Execute the real predicate against a fake stage.
  const predicate = vm.runInContext(`(${smoke.slice(predicateStart, predicateEnd + 1)})`, vm.createContext({ document: { querySelector: () => null } }));
  const tellTicks = Object.fromEntries(Object.entries(ENEMY_ARCHETYPES).map(([id, archetype]) => [id, archetype.attack.tellTicks]));
  const withDataset = (dataset) => vm.runInContext(`(${smoke.slice(predicateStart, predicateEnd + 1)})`, vm.createContext({ document: { querySelector: () => ({ dataset }) } }));
  const rusher = ENEMY_ARCHETYPES['bagholder-rusher'].attack.tellTicks;
  assert.deepEqual(
    // Spread across the vm boundary so the comparison is by value, not by realm prototype.
    { ...withDataset({ enemyTellToStrikeTicks: String(rusher), enemyTellToStrikeArchetype: 'bagholder-rusher', simulationTick: '508', cameraZoom: '1.689' })(tellTicks) },
    { tick: 508, tellToStrikeTicks: rusher, archetypeId: 'bagholder-rusher', cameraZoom: 1.689 },
    'an unstaggered strike resolves with the sample the assertions use',
  );
  assert.equal(withDataset({ enemyTellToStrikeTicks: String(rusher + ENEMY_TELL_STAGGER_TICKS), enemyTellToStrikeArchetype: 'bagholder-rusher', simulationTick: '517', cameraZoom: '1.689' })(tellTicks), null, 'a staggered strike keeps waiting');
  assert.equal(withDataset({ enemyTellToStrikeTicks: '', enemyTellToStrikeArchetype: '', simulationTick: '40', cameraZoom: '1.689' })(tellTicks), null, 'no strike yet keeps waiting');
  assert.equal(withDataset({ enemyTellToStrikeTicks: '15', enemyTellToStrikeArchetype: 'not-an-archetype', simulationTick: '40', cameraZoom: '1.689' })(tellTicks), null, 'an unknown archetype keeps waiting');
  assert.equal(predicate(tellTicks), null, 'a missing stage keeps waiting instead of throwing');
});

test('the boss presentation smoke runs the canister half for every profile before the boss half', async () => {
  const smoke = await readFile(smokeUrl, 'utf8');
  const canisterLoop = smoke.indexOf('for (const profile of profiles) {\n    const canister = await captureCanister(profile);');
  const bossLoop = smoke.indexOf('for (const profile of profiles) results.push(await captureBossPhase(profile));');
  assert.ok(canisterLoop >= 0, 'the canister half (ordinary tells and tell-to-strike at gameplay zoom) has its own profile loop');
  assert.ok(bossLoop > canisterLoop, 'the boss half runs after every profile has produced the tell-to-strike evidence');
  const printed = smoke.indexOf("console.log(JSON.stringify({ status: 'CANISTER', profile: profile.name, tick: canister.tick, tells: canister.tells, timing: canister.timing }));", canisterLoop);
  assert.ok(printed > canisterLoop && printed < bossLoop, 'each canister sample is printed before the boss half can stop the run');
  assert.equal(smoke.match(/await captureCanister\(/g).length, 1);
  assert.equal(smoke.match(/await captureBossPhase\(/g).length, 1);
  assert.doesNotMatch(smoke, /Promise\.all/, 'the profiles stay serial');
});
