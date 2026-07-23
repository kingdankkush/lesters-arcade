import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import {
  createEncounterDirector,
  getEncounterSnapshot,
  stepEncounterDirector,
} from '../apps/hmh-reboot/src/encounter-director.mjs';
import {
  createEnemyPopulation,
  retireEnemyFromPopulation,
} from '../apps/hmh-reboot/src/enemy-simulation.mjs';
import {
  LIQUIDATOR_TARGET_FIGHT_TICKS,
  createLiquidatorBoss,
  simulateLiquidatorDps,
  stepLiquidatorBoss,
} from '../apps/hmh-reboot/src/liquidator-boss.mjs';

const sha = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const PLAYER = Object.freeze({ x: 0, y: 0, groundZ: 0 });
const CAMERA = Object.freeze({ minX: -480, minY: -270, maxX: 480, maxY: 270 });
const DISTRICT_BY_BAND = Object.freeze({
  opening: 'frontier-relay',
  build: 'frontier-relay',
  pressure: 'liquidity-crossing',
  elite: 'mining-camp',
  boss: 'liquidation-yard',
  endurance: 'liquidation-yard',
});
const SPAWNS = Object.freeze(Object.values(DISTRICT_BY_BAND).filter((value, index, all) => all.indexOf(value) === index).map((districtId) => Object.freeze({
  id: `${districtId}-east`, regionId: `${districtId}-region`, districtId, x: 900, y: 0,
})));

function runDirector() {
  const state = createEncounterDirector();
  const population = createEnemyPopulation({ capacity: 192, threatCapacity: 1024 });
  const inserted = [];
  let maxBodies = 0;
  for (let tick = 0; tick <= 108_000; tick += 1) {
    const snapshot = getEncounterSnapshot(tick);
    const report = stepEncounterDirector({
      state,
      population,
      tick,
      districtId: DISTRICT_BY_BAND[snapshot.bandId],
      player: PLAYER,
      camera: CAMERA,
      spawnPoints: SPAWNS,
      nearRewardPoi: false,
      queryGround: () => ({ kind: 'foundation', groundZ: 0, surfaceId: 'soak-flat' }),
      isBlocked: () => false,
      isRouteReachable: () => true,
      visualMode: 'prototype',
    });
    if (report.inserted) inserted.push([tick, report.enemyId, report.archetypeId, report.bandId]);
    if (tick > 0 && tick % 180 === 0 && population.active.length > 120) {
      retireEnemyFromPopulation(population, population.active[0].id, { tick, reason: 'soak-turnover' });
    }
    maxBodies = Math.max(maxBodies, population.active.length);
  }
  const evidence = {
    inserted,
    insertedCount: state.insertedCount,
    retiredCount: population.retiredCount,
    activeCount: population.active.length,
    activeThreat: population.activeThreat,
    seenIds: population.seenIds.size,
    maxBodies,
    snapshots: [5, 10, 20, 30].map((minute) => getEncounterSnapshot(minute * 3_600)),
  };
  return { ...evidence, hash: sha(evidence) };
}

function runBoss(partition) {
  const boss = createLiquidatorBoss({ id: 'liquidator-soak', x: 0, y: 0, startTick: 0 });
  const events = [];
  let accumulator = 0;
  while (boss.elapsedTick < LIQUIDATOR_TARGET_FIGHT_TICKS) {
    accumulator += partition;
    while (accumulator >= 1 && boss.elapsedTick < LIQUIDATOR_TARGET_FIGHT_TICKS) {
      const tick = boss.elapsedTick + 1;
      const report = stepLiquidatorBoss({ boss, tick, player: { x: 160, y: 0, groundZ: 0 } });
      for (const event of report.events) events.push([tick, event.type, event.attackId ?? event.phaseId]);
      accumulator -= 1;
    }
  }
  const evidence = { events, droppedEvents: boss.droppedEvents, pending: boss.pendingAttacks.length, elapsedTick: boss.elapsedTick };
  return { ...evidence, hash: sha(evidence) };
}

if (global.gc) global.gc();
const heapBefore = process.memoryUsage().heapUsed;
const started = performance.now();
const directorA = runDirector();
const directorB = runDirector();
const directorElapsedMs = performance.now() - started;
const bossStarted = performance.now();
const boss60 = runBoss(1);
const boss30 = runBoss(2);
const boss20 = runBoss(3);
const bossElapsedMs = performance.now() - bossStarted;
if (global.gc) global.gc();
const heapAfter = process.memoryUsage().heapUsed;

if (directorA.hash !== directorB.hash) throw new Error('director hashes differ');
if (directorA.insertedCount < 100 || directorA.seenIds !== directorA.insertedCount) throw new Error('director did not preserve recurring stable IDs');
if (boss60.hash !== boss30.hash || boss60.hash !== boss20.hash) throw new Error('boss partition hashes differ');
if (boss60.droppedEvents !== 0 || boss30.droppedEvents !== 0 || boss20.droppedEvents !== 0) throw new Error('boss events dropped');
if (directorElapsedMs > 4_000) throw new Error(`director soak exceeded 4000ms: ${directorElapsedMs}`);
if (bossElapsedMs > 1_000) throw new Error(`boss soak exceeded 1000ms: ${bossElapsedMs}`);

console.log(JSON.stringify({
  director: { hash: directorA.hash, insertedCount: directorA.insertedCount, retiredCount: directorA.retiredCount, activeCount: directorA.activeCount, seenIds: directorA.seenIds, maxBodies: directorA.maxBodies, elapsedMsTwoRuns: Number(directorElapsedMs.toFixed(3)) },
  boss: { hash: boss60.hash, events: boss60.events.length, droppedEvents: boss60.droppedEvents, elapsedMsThreePartitions: Number(bossElapsedMs.toFixed(3)) },
  dps: { noHit: simulateLiquidatorDps({ damagePerTick: 0 }), normal: simulateLiquidatorDps({ damagePerTick: 4 }), high: simulateLiquidatorDps({ damagePerTick: 20 }), low: simulateLiquidatorDps({ damagePerTick: 2 }) },
  heapDelta: heapAfter - heapBefore,
}, null, 2));
