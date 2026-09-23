import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';

import { CHIKUN_BOT_CRUISE_RANGE, CHIKUN_BOT_PROFILES, botCruiseY, botProfile, createChikunBot, createVisiblePilot, mulberry32, profileHash, viewportRightEdge } from '../scripts/lib/chikun-bots.mjs';
import { BOT_MODEL_CHANGES, D11_MEDIAN_BANDS, acceptanceOf, courseDigest, courseFacts, harnessSeed, percentile, playBotRun, runHarness, runPilots, summarizeProfile } from '../scripts/chikun-difficulty-harness.mjs';
import { coursePilot, routePilot } from '../scripts/chikun-course-pilot.mjs';
import { createChikunRuntime } from '../apps/portal/src/chikun-cabinet.mjs';
import { GROUND_PHYSICS } from '../apps/portal/src/chikun-ground-runtime.mjs';
import * as course from '../apps/portal/src/chikun-ground-course.mjs';
import { CHIKUN_REGIONS, REGION_LOOP_SLOTS } from '../apps/portal/src/chikun-course-regions.mjs';
import { CHIKUN_PREVIEW_PX, CHIKUN_PREVIEW_TICKS, buildChikunViewport, upcomingChikunObstacle } from '../apps/chikun/src/viewport.mjs';

const { distanceAtTick, speedAtTick, speedSumBefore, courseObstacleX, courseObstacles, courseKind, SPEED_RAMP } = course;
const harness = JSON.parse(readFileSync(new URL('../docs/qa/chikun-difficulty-harness-20260923.json', import.meta.url), 'utf8'));
const smallPool = () => Math.max(1, Math.min(4, availableParallelism() - 1));

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
  // Cruise heights are seeded per run inside the documented range.
  const cruises = Array.from({ length: 64 }, (_, i) => botCruiseY('hardcore', harnessSeed(i)));
  assert.ok(cruises.every((y) => Number.isInteger(y) && y >= CHIKUN_BOT_CRUISE_RANGE[0] && y <= CHIKUN_BOT_CRUISE_RANGE[1]));
  assert.ok(new Set(cruises).size > 32, 'runs differ in cruise height');
  assert.equal(botCruiseY('hardcore', 99), botCruiseY('hardcore', 99));
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
  const summary = summarizeProfile([
    { minutes: 1, terminalReason: 'storm', flaps: 60, stats: { score: 5 }, regionLoop0Reached: 2, death: { index: 3, region: 'farmland', local: 3, loop: 0 }, markersSeen: 4 },
    { minutes: 2, terminalReason: 'tree', flaps: 100, stats: { score: 9 }, regionLoop0Reached: 6, death: { index: 11, region: 'forest', local: 3, loop: 0 }, markersSeen: 8 },
  ]);
  assert.deepEqual(summary.deathCauses, { storm: 1, tree: 1 });
  assert.deepEqual(summary.deathRegions, { farmland: 1, forest: 1 });
  assert.deepEqual(summary.topDeathSlots, { 'farmland#3 lap 1': 1, 'forest#3 lap 1': 1 });
  assert.equal(summary.flapsPerMinute.p50, 55);
  assert.equal(summary.loop0RegionIndexReached.p50, 4);
  assert.equal(summary.portraitMarkersSeen.p50, 6);
});

test('speed ramp and distance stay exact', () => {
  // Pinned tuned ramp (chikun-ground-course.mjs SPEED_RAMP), exact dyadic values.
  const pins = [[0, 1], [1, 1.274658203125], [2, 1.494384765625], [4, 1.6866455078125], [6, 2.4007568359375], [8, 3.3895263671875], [10, 4.0487060546875], [12, 6.0262451171875], [15, 7.3446044921875]];
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
  // Front-loaded against v5 (1.125x / 1.25x / 1.375x at 1 / 2 / 3 minutes).
  assert.ok(speedAtTick(3_600) > 1.125 && speedAtTick(7_200) > 1.25 && speedAtTick(10_800) > 1.375);
  assert.equal(courseObstacleX(10, 2_000), 1180 + distanceAtTick(3_400) - distanceAtTick(2_000));
  for (const tick of [0, 5_000, 60_000, 150_000]) for (const o of courseObstacles(7, tick)) assert.equal(o.x, courseObstacleX(o.index, tick));
  // New course and runtime math never uses engine-approximated functions (contract A9).
  for (const file of ['../apps/portal/src/chikun-ground-course.mjs', '../apps/portal/src/chikun-ground-runtime.mjs', '../apps/portal/src/chikun-course-regions.mjs']) {
    const code = readFileSync(new URL(file, import.meta.url), 'utf8').split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
    assert.doesNotMatch(code, /Math\.(sqrt|pow|exp|expm1|log\w*|hypot|cbrt|sin|cos|tan|asin|acos|atan\w*|sinh|cosh|tanh|random)\b|\*\*/, file);
  }
});

test('harness sample stays inside the D11 bands', async () => {
  // A fixed small pool; the time bound scales with it, so small machines are not flaky.
  const workers = smallPool();
  const started = Date.now();
  const { byProfile, workers: used } = await runHarness({ profiles: ['novice', 'hardcore'], runs: 16, capMinutes: 20, workers });
  const elapsed = Date.now() - started;
  assert.equal(used, workers);
  for (const name of ['novice', 'hardcore']) {
    const [low, high] = D11_MEDIAN_BANDS[name];
    const median = summarizeProfile(byProfile[name]).survivalMinutes.p50;
    assert.ok(median >= low - 0.75 && median <= high + 0.75, `${name} median ${median} min`);
    assert.equal(byProfile[name].length, 16);
  }
  assert.ok(elapsed < 45_000 * Math.max(1, 4 / workers), `sample took ${elapsed} ms on ${workers} workers`);
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
  assert.equal(harness.hoverPilot.medianMinutes, percentile(minutes, 0.5));
});

test('a hover that ducks under planes dies inside D11 on what a player can see', async () => {
  // routePilot hovers high, ducks under the top-band planes and drops for low
  // passages. Limited to the screen (landscape x < 1280; a 390 x 844 phone plus
  // the in-game marker) and a reaction delay, it never reaches 15 minutes.
  const pilots = await runPilots({ seeds: 16, names: ['routePilotLandscape', 'routePilotPortrait'], workers: smallPool() });
  for (const [name, report] of Object.entries(pilots)) {
    assert.equal(report.seeds, 16);
    assert.ok(report.maxMinutes < 15, `${name} max ${report.maxMinutes} min`);
    assert.ok(report.medianMinutes <= 12, `${name} median ${report.medianMinutes} min`);
    assert.equal(report.causes['run-complete'], undefined, name);
    assert.deepEqual(report, harness.pilots[name], `${name} matches the committed report`);
  }
  assert.ok(pilots.routePilotPortrait.medianMinutes < 5, 'a phone hover cannot drop in time for a low passage it has not seen');
  // The same pilot reading the whole runtime snapshot (obstacles far past any
  // screen) is a solver; the report keeps it for the record.
  assert.equal(harness.pilots.routePilotFullSnapshot.seeds, 16);
});

test('low passages are seeded per region visit, so the loop cannot be memorised', () => {
  const isLow = (seed, index) => ['storm', 'canopy'].includes(courseKind(seed, index));
  const lowSlots = (seed) => Array.from({ length: REGION_LOOP_SLOTS * 2 }, (_, index) => index).filter((index) => isLow(seed, index));
  const patterns = new Set();
  const counts = new Array(REGION_LOOP_SLOTS * 2).fill(0);
  for (let seed = 1; seed <= 64; seed += 1) {
    const slots = lowSlots(seed);
    patterns.add(slots.join(','));
    for (const slot of slots) counts[slot] += 1;
    // Each region visit keeps its count of low passages.
    for (let loop = 0; loop < 2; loop += 1) {
      let start = loop * REGION_LOOP_SLOTS;
      for (const region of CHIKUN_REGIONS) {
        const inside = slots.filter((slot) => slot >= start && slot < start + region.slots);
        assert.equal(inside.length, region.low.count, `${region.id} lap ${loop + 1} seed ${seed}`);
        start += region.slots;
      }
    }
    // Never two in a row and never right after a gap.
    for (const slot of slots) {
      assert.ok(!slots.includes(slot + 1), `seed ${seed}: low passages at ${slot} and ${slot + 1}`);
      assert.ok(!['pit', 'waterfall'].includes(courseKind(seed, slot - 1)), `seed ${seed}: low passage ${slot} follows a gap`);
    }
  }
  assert.ok(patterns.size >= 60, `${patterns.size} distinct low-passage layouts over 64 seeds`);
  // No slot is a low passage for more than about two seeds in three (the forest
  // places two among three slots), so a learned layout guesses wrong.
  assert.ok(Math.max(...counts) <= 64 * 0.75, `busiest low slot ${Math.max(...counts)} / 64`);
  // A slot memoriser (the majority layout over seeds 1-64) predicts under half of another seed's low passages.
  const memorised = new Set(counts.flatMap((n, slot) => (n > 32 ? [slot] : [])));
  let hits = 0, total = 0;
  for (let seed = 101; seed <= 132; seed += 1) for (const slot of lowSlots(seed)) { total += 1; if (memorised.has(slot)) hits += 1; }
  assert.ok(hits / total < 0.5, `memoriser hit rate ${(hits / total).toFixed(2)}`);
});

test('portrait bots read the in-game marker, capped at the landscape view', () => {
  const view = buildChikunViewport(390, 844, 1);
  const right = view.left + view.width;
  const tree = (x, speed) => upcomingChikunObstacle([{ index: 4, kind: 'tree', x, width: 180, passed: false }], view, speed);
  assert.equal(CHIKUN_PREVIEW_PX, 360);
  assert.equal(CHIKUN_PREVIEW_TICKS, 50);
  assert.equal(tree(right + 20, 1)?.index, 4, 'just past the phone screen');
  assert.equal(tree(280 + 361, 1), null, 'at 1x the preview reaches 360 px ahead');
  assert.equal(tree(280 + 2.4 * 5 * 50 - 1, 5)?.index, 4, 'at speed it gives 50 ticks of warning');
  assert.equal(tree(1279, 20)?.index, 4);
  assert.equal(tree(1281, 20), null, 'never past the landscape screen');
  assert.equal(upcomingChikunObstacle([{ index: 4, kind: 'tree', x: 900, width: 180, passed: false }], buildChikunViewport(1280, 720, 1), 5), null, 'landscape has no marker');
  // The bot calls the game's marker function, and what it marks becomes known to the bot.
  let calls = 0, marked = 0;
  const spy = (obstacles, v, speed) => { calls += 1; const next = upcomingChikunObstacle(obstacles, v, speed); if (next) marked += 1; return next; };
  const seed = harnessSeed(3);
  const bot = createChikunBot({ profile: botProfile('novice'), seed, course, physics: GROUND_PHYSICS, marker: spy });
  const runtime = createChikunRuntime({ seed, maxTicks: 5_400 });
  while (!runtime.terminal) runtime.step({ flap: bot.decide(runtime.snapshot()) });
  assert.ok(calls > 1_000 && marked > 0 && bot.markersSeen > 0, `marker calls ${calls}, marked ${marked}, learned ${bot.markersSeen}`);
  const landscape = createChikunBot({ profile: botProfile('expert'), seed, course, physics: GROUND_PHYSICS, marker: () => { throw new Error('landscape bots never read the marker'); } });
  const flat = createChikunRuntime({ seed, maxTicks: 600 });
  while (!flat.terminal) flat.step({ flap: landscape.decide(flat.snapshot()) });
  for (const name of ['novice', 'intermediate']) assert.ok(harness.profiles[name].portraitMarkersSeen.p50 > 0, `${name} runs saw the marker`);
});

test('a scripted pilot sees only the screen when wrapped as a player', () => {
  const seen = [];
  const pilot = createVisiblePilot((snapshot) => { seen.push(snapshot.forks.map((o) => o.x)); return false; }, { orientation: 'portrait', width: 390, height: 844, delay: 3 });
  const runtime = createChikunRuntime({ seed: 5, maxTicks: 900 });
  const snapshots = [];
  while (!runtime.terminal) { const s = runtime.snapshot(); snapshots.push(s); runtime.step({ flap: pilot(s) }); }
  const view = buildChikunViewport(390, 844, 1);
  const right = view.left + view.width;
  for (let i = 0; i < seen.length; i += 1) {
    const old = snapshots[Math.max(0, i - 3)];
    const marker = upcomingChikunObstacle(old.forks, view, old.difficulty.speedMultiplier);
    assert.deepEqual(seen[i], old.forks.filter((o) => o.x < right || o === marker).map((o) => o.x), `tick ${i}`);
  }
  assert.throws(() => createVisiblePilot(routePilot, { orientation: 'portrait', width: 1280, height: 720 }), /orientation/);
});

test('committed harness report meets the D11 acceptance, matches the course and carries the achievement stats', () => {
  assert.equal(harness.version, 'chikun-difficulty-harness-v1');
  // The report is tied to the live course: ramp, geometry fingerprint and marker.
  assert.deepEqual(harness.course, JSON.parse(JSON.stringify(courseFacts())));
  assert.deepEqual(harness.course.speedRamp, JSON.parse(JSON.stringify(SPEED_RAMP)));
  for (const [minute, speed] of Object.entries(harness.course.speedByMinute)) assert.equal(speed, speedAtTick(Number(minute) * 3600), `${minute} min`);
  assert.equal(harness.course.courseDigest, courseDigest());
  assert.equal(harness.course.evidenceVersion, 'chikun-flap-evidence-v6');
  assert.equal(harness.runsPerProfile, 200);
  assert.deepEqual(harness.botProfiles, JSON.parse(JSON.stringify(CHIKUN_BOT_PROFILES)));
  assert.ok(Array.isArray(harness.botChanges));
  assert.deepEqual(harness.botModelChanges, JSON.parse(JSON.stringify(BOT_MODEL_CHANGES)));
  assert.ok(harness.botModel.includes(`${CHIKUN_BOT_CRUISE_RANGE[0]}-${CHIKUN_BOT_CRUISE_RANGE[1]} px`));
  assert.ok(harness.environment.cpus >= 1 && harness.environment.workers >= 1);
  assert.ok(harness.assumptions.some((line) => /memorise/.test(line)) && harness.assumptions.some((line) => /solver/.test(line)));
  const recomputed = acceptanceOf(harness.profiles, harness.pilots);
  assert.equal(recomputed.pass, true, JSON.stringify(recomputed.checks.filter((c) => !c.pass)));
  assert.deepEqual(recomputed, harness.acceptance);
  const keys = ['score', 'forksPassed', 'nearMisses', 'coinsCollected', 'bestCombo', 'nearMissStreakBest', 'flawlessRegions', 'distanceMeters', 'regionIndexReached', 'laps', 'speedMultiplierReached'];
  for (const profile of CHIKUN_BOT_PROFILES) {
    const report = harness.profiles[profile.name];
    assert.equal(report.runs, 200);
    assert.deepEqual(Object.keys(report.survivalMinutes), ['p10', 'p25', 'p50', 'p75', 'p90', 'p95', 'p99']);
    assert.equal(typeof report.over15MinutesFraction, 'number');
    assert.equal(Object.values(report.deathCauses).reduce((sum, n) => sum + n, 0), 200);
    assert.ok(Object.keys(report.topDeathSlots).length > 0 && Object.keys(report.deathRegions).length > 0);
    for (const key of keys) assert.deepEqual(Object.keys(report.stats[key]), ['p10', 'p50', 'p90', 'p99'], `${profile.name} ${key}`);
    assert.ok(report.flapsPerMinute.p50 > 0 && report.flapsPerMinute.p99 >= report.flapsPerMinute.p50);
    const base = harness.baseline.profiles[profile.name];
    assert.equal(base.runs, 200, 'the untuned baseline is kept for comparison');
    for (const cruiseY of ['420', '480', '540']) assert.equal(typeof harness.cruiseSensitivity.medianMinutesByCruiseY[cruiseY][profile.name], 'number');
  }
  // Seeded low passages and per-run cruise heights spread the distributions.
  for (const name of ['expert', 'hardcore', 'exceptional']) {
    const s = harness.profiles[name].survivalMinutes;
    assert.ok(s.p90 - s.p10 >= 1.5, `${name} p10-p90 spread ${s.p10}-${s.p90}`);
  }
  assert.ok(harness.profiles.hardcore.stats.bestCombo.p50 < harness.profiles.hardcore.stats.forksPassed.p50, 'bestCombo is not forksPassed');
});
