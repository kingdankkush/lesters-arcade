import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
  simulateHmhRunEconomy,
  levelFromCumulativeXp,
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
