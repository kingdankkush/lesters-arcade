import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
  simulateHmhRunEconomy,
  levelFromCumulativeXp,
} from '../apps/portal/src/hmh-run-simulator.mjs';

test('levelFromCumulativeXp follows the current roguelike XP cost curve', () => {
  assert.equal(levelFromCumulativeXp(0), 1);
  assert.equal(levelFromCumulativeXp(99), 1);
  assert.equal(levelFromCumulativeXp(100), 2);
  assert.equal(levelFromCumulativeXp(261), 2);
  assert.equal(levelFromCumulativeXp(262), 3);
});

test('simulator calibrates to current Level 1 XP-income ground truth before rebalance', () => {
  const sim = simulateHmhRunEconomy({ minutes: 20, skillFactor: 1, tickSeconds: 1 });
  const m0 = sim.timeline.find((point) => point.minute === 0);
  const m4 = sim.timeline.find((point) => point.minute === 4);
  const m8 = sim.timeline.find((point) => point.minute === 8);
  const m20 = sim.timeline.find((point) => point.minute === 20);

  assert.ok(m0.xpPerSecond >= 3.7 && m0.xpPerSecond <= 5.4, `0:00 XP/s expected ~4.5, got ${m0.xpPerSecond}`);
  assert.ok(m4.xpPerSecond >= 7.0 && m4.xpPerSecond <= 9.4, `4:00 XP/s expected ~8, got ${m4.xpPerSecond}`);
  assert.ok(m8.xpPerSecond >= 20.5 && m8.xpPerSecond <= 26.0, `8:00 XP/s expected ~23, got ${m8.xpPerSecond}`);
  assert.ok(m8.cumulativeXp >= 4_700 && m8.cumulativeXp <= 5_900, `8:00 cumulative XP expected ~5k-5.5k, got ${m8.cumulativeXp}`);
  assert.ok(m20.cumulativeXp >= 20_000 && m20.cumulativeXp <= 27_000, `20:00 cumulative XP expected ~22k-25.5k, got ${m20.cumulativeXp}`);
  assert.ok(m20.level >= 18 && m20.level <= 22, `pre-rebalance 20-minute run should still top out near level 20, got ${m20.level}`);
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
