import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CHIKUN_BOT_PROFILES, mulberry32, profileHash, viewportRightEdge } from '../scripts/lib/chikun-bots.mjs';
import { D11_MEDIAN_BANDS, acceptanceOf, harnessSeed, percentile, playBotRun, runHarness, summarizeProfile } from '../scripts/chikun-difficulty-harness.mjs';
import { coursePilot } from '../scripts/chikun-course-pilot.mjs';
import { createChikunRuntime } from '../apps/portal/src/chikun-cabinet.mjs';
import { distanceAtTick, speedAtTick, speedSumBefore, courseObstacleX, courseObstacles } from '../apps/portal/src/chikun-ground-course.mjs';

const harness = JSON.parse(readFileSync(new URL('../docs/qa/chikun-difficulty-harness-20260923.json', import.meta.url), 'utf8'));

test('bot profiles are the fixed D11 table and bots are seeded, never Math.random', () => {
  assert.deepEqual(CHIKUN_BOT_PROFILES.map((p) => [p.name, p.reactionDelayTicks, p.jitterSigmaTicks, p.lookAheadPx, p.viewport.orientation]), [
    ['novice', 24, 5, 260, 'portrait'],
    ['intermediate', 18, 3.5, 360, 'portrait'],
    ['expert', 12, 2, 520, 'landscape'],
    ['hardcore', 8, 1.2, 700, 'landscape'],
    ['exceptional', 5, 0.8, 1000, 'landscape'],
  ]);
  assert.ok(Math.abs(viewportRightEdge({ orientation: 'portrait', width: 390, height: 844 }) - 527) < 1, 'portrait sees world x up to about 527');
  const a = mulberry32(7 ^ profileHash('novice')), b = mulberry32(7 ^ profileHash('novice'));
  for (let i = 0; i < 5; i += 1) assert.equal(a(), b());
  const original = Math.random;
  Math.random = () => { throw new Error('bots must not call Math.random'); };
  try {
    const first = playBotRun({ profileName: 'novice', seed: harnessSeed(0), maxTicks: 2400, courseKey: 'v5' });
    const second = playBotRun({ profileName: 'novice', seed: harnessSeed(0), maxTicks: 2400, courseKey: 'v5' });
    assert.deepEqual(first, second);
    const live = playBotRun({ profileName: 'expert', seed: harnessSeed(1), maxTicks: 3600 });
    assert.deepEqual(playBotRun({ profileName: 'expert', seed: harnessSeed(1), maxTicks: 3600 }), live);
  } finally {
    Math.random = original;
  }
  assert.equal(percentile([1, 2, 3, 4], 0.5), 2.5);
  const summary = summarizeProfile([{ minutes: 1, terminalReason: 'storm', flaps: 60, stats: { score: 5 }, regionLoop0Reached: 2 }, { minutes: 2, terminalReason: 'tree', flaps: 100, stats: { score: 9 }, regionLoop0Reached: 6 }]);
  assert.deepEqual(summary.deathCauses, { storm: 1, tree: 1 });
  assert.equal(summary.flapsPerMinute.p50, 55);
  assert.equal(summary.loop0RegionIndexReached.p50, 4);
});

test('speed ramp and distance stay exact', () => {
  // Pinned tuned ramp (chikun-ground-course.mjs SPEED_RAMP), exact dyadic values.
  const pins = [[0, 1], [1, 1.054931640625], [2, 1.10986328125], [4, 1.384521484375], [6, 2.20849609375], [8, 3.142333984375], [10, 3.801513671875], [12, 5.449462890625], [15, 7.097412109375]];
  for (const [minute, speed] of pins) assert.equal(speedAtTick(minute * 3600), speed, `${minute} min`);
  let running = 0;
  for (let n = 0; n <= 36_000; n += 1) {
    assert.equal(speedSumBefore(n), running, `sum before ${n}`);
    assert.equal(distanceAtTick(n), 2.4 * running, `distance at ${n}`);
    running += speedAtTick(n);
  }
  // Past the hour breakpoints the closed form keeps matching the running sum.
  for (let n = 36_001; n <= 216_000; n += 1) {
    if (n % 9_000 === 0 || n === 43_200 || n === 54_000 || n === 216_000) assert.equal(speedSumBefore(n), running, `sum before ${n}`);
    running += speedAtTick(n);
  }
  assert.equal(speedAtTick(215_999.7), speedAtTick(215_999), 'fractional ticks floor');
  assert.equal(courseObstacleX(10, 2_000), 1180 + distanceAtTick(3_400) - distanceAtTick(2_000));
  for (const tick of [0, 5_000, 60_000, 150_000]) for (const o of courseObstacles(7, tick)) assert.equal(o.x, courseObstacleX(o.index, tick));
  // New course and runtime math never uses engine-approximated functions (contract A9).
  for (const file of ['../apps/portal/src/chikun-ground-course.mjs', '../apps/portal/src/chikun-ground-runtime.mjs', '../apps/portal/src/chikun-course-regions.mjs']) {
    const code = readFileSync(new URL(file, import.meta.url), 'utf8').split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
    assert.doesNotMatch(code, /Math\.(sqrt|pow|exp|expm1|log\w*|hypot|cbrt|sin|cos|tan|asin|acos|atan\w*|sinh|cosh|tanh|random)\b|\*\*/, file);
  }
});

test('harness sample stays inside the D11 bands', async () => {
  const started = Date.now();
  const { byProfile } = await runHarness({ profiles: ['novice', 'hardcore'], runs: 16, capMinutes: 20 });
  const elapsed = Date.now() - started;
  for (const name of ['novice', 'hardcore']) {
    const [low, high] = D11_MEDIAN_BANDS[name];
    const median = summarizeProfile(byProfile[name]).survivalMinutes.p50;
    assert.ok(median >= low - 0.75 && median <= high + 0.75, `${name} median ${median} min`);
    assert.equal(byProfile[name].length, 16);
  }
  assert.ok(elapsed < 45_000, `sample took ${elapsed} ms`);
});

test('hover pilot no longer survives', () => {
  const minutes = [];
  for (let seed = 1; seed <= 16; seed += 1) {
    const runtime = createChikunRuntime({ seed, maxTicks: 216_000 });
    while (!runtime.terminal) runtime.step({ flap: coursePilot(runtime.snapshot()) });
    const result = runtime.result();
    assert.notEqual(result.finalState.terminalReason, 'run-complete');
    minutes.push(result.survivalTicks / 3600);
  }
  minutes.sort((a, b) => a - b);
  assert.ok(percentile(minutes, 0.5) < 4, `hover pilot median ${percentile(minutes, 0.5)} min`);
  assert.ok(harness.hoverPilot.medianMinutes < 4);
});

test('committed harness report meets the D11 acceptance and carries the achievement stats', () => {
  assert.equal(harness.version, 'chikun-difficulty-harness-v1');
  assert.equal(harness.course.evidenceVersion, 'chikun-flap-evidence-v6');
  assert.equal(harness.runsPerProfile, 200);
  assert.deepEqual(harness.botProfiles, JSON.parse(JSON.stringify(CHIKUN_BOT_PROFILES)));
  assert.ok(Array.isArray(harness.botChanges));
  const recomputed = acceptanceOf(harness.profiles);
  assert.equal(recomputed.pass, true, JSON.stringify(recomputed.checks.filter((c) => !c.pass)));
  assert.equal(harness.acceptance.pass, true);
  const keys = ['score', 'forksPassed', 'nearMisses', 'coinsCollected', 'bestCombo', 'nearMissStreakBest', 'flawlessRegions', 'distanceMeters', 'regionIndexReached', 'laps', 'speedMultiplierReached'];
  for (const profile of CHIKUN_BOT_PROFILES) {
    const report = harness.profiles[profile.name];
    assert.equal(report.runs, 200);
    assert.deepEqual(Object.keys(report.survivalMinutes), ['p10', 'p25', 'p50', 'p75', 'p90', 'p95', 'p99']);
    assert.equal(typeof report.over15MinutesFraction, 'number');
    assert.equal(Object.values(report.deathCauses).reduce((sum, n) => sum + n, 0), 200);
    for (const key of keys) assert.deepEqual(Object.keys(report.stats[key]), ['p10', 'p50', 'p90', 'p99'], `${profile.name} ${key}`);
    assert.ok(report.flapsPerMinute.p50 > 0 && report.flapsPerMinute.p99 >= report.flapsPerMinute.p50);
    const base = harness.baseline.profiles[profile.name];
    assert.equal(base.runs, 200, 'the untuned baseline is kept for comparison');
  }
  assert.ok(harness.profiles.hardcore.stats.bestCombo.p50 < harness.profiles.hardcore.stats.forksPassed.p50, 'bestCombo is not forksPassed');
});
