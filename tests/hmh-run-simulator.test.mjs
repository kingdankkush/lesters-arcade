import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
  simulateHmhRunEconomy,
  levelFromCumulativeXp,
  summarizeHmhLongRunTelemetry,
} from '../apps/portal/src/hmh-run-simulator.mjs';
import {
  ROGUELIKE_LEVEL_CAP,
  POST_CAP_XP_TO_SCORE,
  roguelikeXpCostForLevel,
} from '../apps/portal/src/arcade-core.mjs';

test('Wave 2 XP curve has an 80-level cap and post-cap score conversion constants', () => {
  assert.equal(ROGUELIKE_LEVEL_CAP, 80);
  assert.equal(POST_CAP_XP_TO_SCORE, 2);
  assert.equal(levelFromCumulativeXp(0), 1);
  assert.equal(levelFromCumulativeXp(roguelikeXpCostForLevel(1)), 2);
  assert.equal(levelFromCumulativeXp(1_000_000), 80);
});

test('Wave 2 economy simulator hits Fable 60-80 level bands', () => {
  const strong = simulateHmhRunEconomy({ minutes: 28, skillFactor: 0.9, tickSeconds: 1 });
  const average20 = simulateHmhRunEconomy({ minutes: 20, skillFactor: 0.75, tickSeconds: 1 }).summary;
  const m8 = strong.timeline.find((point) => point.minute === 8);
  const m20 = strong.timeline.find((point) => point.minute === 20);
  const m28 = strong.timeline.find((point) => point.minute === 28);

  assert.ok(m8.level >= 30 && m8.level <= 38, `strong 8:00 run should be level 30-38, got ${m8.level}`);
  assert.ok(m20.level >= 58 && m20.level <= 70, `strong 20:00 run should be level 58-70, got ${m20.level}`);
  assert.ok(m28.level >= 72 && m28.level <= 80, `strong 28:00 run should be level 72-80, got ${m28.level}`);
  assert.ok(average20.level >= 45, `average 20:00 run should reach at least level 45, got ${average20.level}`);
  assert.ok(m28.cumulativeXp > m20.cumulativeXp, 'record-chase runs keep gaining XP after the 20-minute elite band');
});

test('skill factor affects kill throughput and leveling in the coarse economy model', () => {
  const average = simulateHmhRunEconomy({ minutes: 20, skillFactor: 0.75 });
  const strong = simulateHmhRunEconomy({ minutes: 20, skillFactor: 0.9 });
  const perfect = simulateHmhRunEconomy({ minutes: 20, skillFactor: 1 });

  assert.ok(average.summary.cumulativeXp < strong.summary.cumulativeXp);
  assert.ok(strong.summary.cumulativeXp < perfect.summary.cumulativeXp);
  assert.ok(average.summary.level <= strong.summary.level);
  assert.ok(strong.summary.level <= perfect.summary.level);
});

test('simulator runs 30 simulated minutes quickly and emits minute timeline points', () => {
  const start = performance.now();
  const sim = simulateHmhRunEconomy({ minutes: 30, skillFactor: 1, tickSeconds: 0.5 });
  const elapsedMs = performance.now() - start;

  assert.equal(sim.timeline.length, 31);
  assert.equal(sim.timeline[0].minute, 0);
  assert.equal(sim.timeline.at(-1).minute, 30);
  assert.ok(Number.isFinite(sim.summary.cumulativeXp));
  assert.ok(elapsedMs < 100, `30 sim-minutes should run in <100ms, took ${elapsedMs.toFixed(2)}ms`);
});

test('long-run telemetry reports elite-band pacing, cap timing, and post-cap score pressure', () => {
  const telemetry = summarizeHmhLongRunTelemetry({ minutes: 35, skillFactors: [0.75, 0.9, 1], tickSeconds: 1 });

  assert.equal(telemetry.version, 'wave2-long-run-telemetry-v1');
  assert.equal(telemetry.levelCap, ROGUELIKE_LEVEL_CAP);
  assert.deepEqual(telemetry.skillFactors, [0.75, 0.9, 1]);
  assert.ok(telemetry.bands.strong20.level >= 58 && telemetry.bands.strong20.level <= 70);
  assert.ok(telemetry.bands.strong28.level >= 72 && telemetry.bands.strong28.level <= 80);
  assert.ok(telemetry.capTiming.perfect.minute <= 35, 'perfect run should reach cap within telemetry window');
  assert.ok(telemetry.postCap.perfect.scoreBonus > 0, 'post-cap XP should convert to score for record-chase runs');
  assert.ok(telemetry.flags.length === 0, `telemetry flags should be empty: ${JSON.stringify(telemetry.flags)}`);
});

test('WO-42 simulator logs composition pressure and five threat-beat types by minute 15', () => {
  const sim = simulateHmhRunEconomy({ minutes: 15, skillFactor: 0.85, seed: 20260701, tickSeconds: 1 });
  const late = sim.timeline.find((point) => point.minute === 12);
  const beatTypes = new Set(sim.threatBeatLog.map((beat) => beat.type));

  assert.ok(late.archetypeMixCount >= 6, `minute 12 should expose 6+ archetypes, got ${late.archetypeMixCount}`);
  assert.ok(late.packCohesion >= 0.45, `minute 12 pack cohesion should be meaningful, got ${late.packCohesion}`);
  assert.ok(late.patternDensity >= 1.7, `minute 12 pattern density should replace HP inflation, got ${late.patternDensity}`);
  assert.ok(beatTypes.size >= 5, `15-minute sim should log five beat types, got ${[...beatTypes].join(', ')}`);
  assert.ok(sim.summary.healthMultiplier <= 2, `summary HP multiplier should cap at 2x, got ${sim.summary.healthMultiplier}`);
});
