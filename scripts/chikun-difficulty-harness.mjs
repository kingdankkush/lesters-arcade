// Chikun difficulty harness (chikun-tune slice, decision D11).
//
// Plays seeded headless runs for each bot profile in scripts/lib/chikun-bots.mjs
// on the pure runtime and reports survival percentiles, death causes, stat
// percentiles and flap rates. Usage:
//   node scripts/chikun-difficulty-harness.mjs --runs 200            # writes the QA JSON
//   node scripts/chikun-difficulty-harness.mjs --runs 16 --no-write  # quick sample
//   node scripts/chikun-difficulty-harness.mjs --course v5 --baseline --runs 200 --cap-minutes 30
// Options: --profiles a,b  --cap-minutes N (default 60)  --workers N  --out <path>
// Seeds are fixed: run i of every profile uses harnessSeed(i).
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as liveCourse from '../apps/portal/src/chikun-ground-course.mjs';
import * as v5Course from '../apps/portal/src/chikun-ground-v5-course.mjs';
import * as liveRuntime from '../apps/portal/src/chikun-ground-runtime.mjs';
import { resolve } from 'node:path';
import { createChikunRuntime, flapTicksOf, CHIKUN_EVIDENCE_VERSION, CHIKUN_RUNTIME_VERSION, CHIKUN_CABINET_VERSION } from '../apps/portal/src/chikun-cabinet.mjs';
import { CHIKUN_BOT_PROFILES, CHIKUN_V5_PHYSICS, botProfile, createChikunBot } from './lib/chikun-bots.mjs';
import { coursePilot } from './chikun-course-pilot.mjs';
const { SPEED_RAMP, SPEED_SLOPE_UNIT, speedAtTick } = liveCourse;

export const HARNESS_JSON = 'docs/qa/chikun-difficulty-harness-20260923.json';
export const HARNESS_VERSION = 'chikun-difficulty-harness-v1';
const TICKS_PER_MINUTE = 3600;

export function harnessSeed(index) {
  // Fixed, spread-out 32-bit seeds (golden-ratio stride from a fixed origin).
  return (Math.imul(index + 1, 0x9e3779b1) ^ 0x2545f491) >>> 0;
}

const COURSES = {
  live: () => ({ course: liveCourse, physics: liveRuntime.GROUND_PHYSICS ?? CHIKUN_V5_PHYSICS, evidenceVersion: CHIKUN_EVIDENCE_VERSION }),
  v5: () => ({ course: v5Course, physics: CHIKUN_V5_PHYSICS, evidenceVersion: 'chikun-flap-evidence-v5' }),
};

// One seeded run. Throws from the runtime are recorded as terminalReason 'flap-cap'.
export function playBotRun({ profileName, seed, maxTicks, courseKey = 'live', skim = 0, keepResult = false }) {
  const { course, physics, evidenceVersion } = COURSES[courseKey]();
  const profile = botProfile(profileName);
  const runtime = createChikunRuntime({ seed, maxTicks, evidenceVersion });
  const bot = createChikunBot({ profile, seed, course, physics, skim });
  let thrown = null;
  try {
    while (!runtime.terminal) runtime.step({ flap: bot.decide(runtime.snapshot()) });
  } catch (error) {
    thrown = error instanceof Error ? error.message : String(error);
  }
  const snapshot = runtime.snapshot();
  const result = runtime.result();
  const ticks = result ? result.survivalTicks : snapshot.tick;
  const flaps = result ? flapTicksOf(result.evidence).length : bot.presses;
  return {
    profile: profileName,
    seed,
    survivalTicks: ticks,
    minutes: ticks / TICKS_PER_MINUTE,
    terminalReason: thrown ? 'flap-cap' : result.finalState.terminalReason,
    flaps,
    stats: {
      score: result ? result.score : snapshot.score,
      forksPassed: result ? result.forksPassed : snapshot.forksPassed,
      nearMisses: result ? result.nearMisses : snapshot.nearMisses,
      coinsCollected: result ? result.coinsCollected : snapshot.coinsCollected,
      bestCombo: result ? result.bestCombo : snapshot.bestCombo,
      nearMissStreakBest: result?.nearMissStreakBest ?? null,
      flawlessRegions: result?.flawlessRegions ?? null,
      distanceMeters: Math.floor(course.distanceAtTick(ticks) / 10),
      regionIndexReached: result?.regionIndexReached ?? null,
      laps: result?.laps ?? null,
      speedMultiplierReached: Number(course.speedAtTick(ticks).toFixed(2)),
    },
    regionLoop0Reached: result?.regionIndexReached != null && result.laps === 0 ? result.regionIndexReached : result?.laps > 0 ? 6 : null,
    ...(keepResult ? { result } : {}),
  };
}

export function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * p;
  const low = Math.floor(position), high = Math.ceil(position);
  const value = sorted[low] + (sorted[high] - sorted[low]) * (position - low);
  return Math.round(value * 1000) / 1000;
}

const STAT_KEYS = ['score', 'forksPassed', 'nearMisses', 'coinsCollected', 'bestCombo', 'nearMissStreakBest', 'flawlessRegions', 'distanceMeters', 'regionIndexReached', 'laps', 'speedMultiplierReached'];

export function summarizeProfile(records) {
  const minutes = records.map((r) => r.minutes).sort((a, b) => a - b);
  const causes = {};
  for (const r of records) causes[r.terminalReason] = (causes[r.terminalReason] ?? 0) + 1;
  const stats = {};
  for (const key of STAT_KEYS) {
    const values = records.map((r) => r.stats[key]).filter((v) => typeof v === 'number').sort((a, b) => a - b);
    stats[key] = values.length ? { p10: percentile(values, 0.1), p50: percentile(values, 0.5), p90: percentile(values, 0.9), p99: percentile(values, 0.99) } : null;
  }
  const rates = records.filter((r) => r.minutes > 0).map((r) => r.flaps / r.minutes).sort((a, b) => a - b);
  const loop0 = records.map((r) => r.regionLoop0Reached).filter((v) => typeof v === 'number').sort((a, b) => a - b);
  return {
    runs: records.length,
    survivalMinutes: Object.fromEntries([['p10', 0.1], ['p25', 0.25], ['p50', 0.5], ['p75', 0.75], ['p90', 0.9], ['p95', 0.95], ['p99', 0.99]].map(([k, p]) => [k, percentile(minutes, p)])),
    over15MinutesFraction: Math.round(records.filter((r) => r.minutes > 15).length / records.length * 1000) / 1000,
    deathCauses: Object.fromEntries(Object.entries(causes).sort((a, b) => b[1] - a[1])),
    stats,
    flapsPerMinute: { p50: percentile(rates, 0.5), p99: percentile(rates, 0.99) },
    loop0RegionIndexReached: loop0.length ? { p10: percentile(loop0, 0.1), p50: percentile(loop0, 0.5), p90: percentile(loop0, 0.9) } : null,
  };
}

// Runs every (profile, seed) task on a worker pool; output order is fixed.
export async function runHarness({ profiles = CHIKUN_BOT_PROFILES.map((p) => p.name), runs = 200, capMinutes = 60, courseKey = 'live', workers = Math.max(1, Math.min(16, availableParallelism() - 2)) } = {}) {
  const maxTicks = Math.min(216_000, Math.round(capMinutes * TICKS_PER_MINUTE));
  const tasks = [];
  for (const profileName of profiles) for (let i = 0; i < runs; i += 1) tasks.push({ id: tasks.length, profileName, seed: harnessSeed(i), maxTicks, courseKey });
  // Longest-expected first keeps the pool busy.
  const order = [...tasks].sort((a, b) => profiles.indexOf(b.profileName) - profiles.indexOf(a.profileName) || a.id - b.id);
  const results = new Array(tasks.length);
  const poolSize = Math.max(1, Math.min(workers, tasks.length));
  let next = 0;
  await Promise.all(Array.from({ length: poolSize }, () => new Promise((resolve, reject) => {
    const worker = new Worker(fileURLToPath(import.meta.url));
    const feed = () => {
      if (next >= order.length) { worker.terminate().then(resolve, reject); return; }
      worker.postMessage(order[next++]);
    };
    worker.on('message', (message) => {
      if (message.error) { worker.terminate(); reject(new Error(message.error)); return; }
      results[message.id] = message.record;
      feed();
    });
    worker.on('error', reject);
    feed();
  })));
  const byProfile = {};
  for (const profileName of profiles) byProfile[profileName] = results.filter((r) => r.profile === profileName);
  return { maxTicks, byProfile };
}

function parseArgs(argv) {
  const args = { runs: 200, capMinutes: 60, courseKey: 'live', write: true, baseline: false, fixtures: false, profiles: null, workers: null, out: HARNESS_JSON };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--runs') args.runs = Number(argv[++i]);
    else if (flag === '--cap-minutes') args.capMinutes = Number(argv[++i]);
    else if (flag === '--course') args.courseKey = argv[++i] === 'v5' ? 'v5' : 'live';
    else if (flag === '--profiles') args.profiles = argv[++i].split(',');
    else if (flag === '--workers') args.workers = Number(argv[++i]);
    else if (flag === '--out') args.out = argv[++i];
    else if (flag === '--no-write') args.write = false;
    else if (flag === '--baseline') args.baseline = true;
    else if (flag === '--v6-fixtures') args.fixtures = true;
    else throw new Error(`Unknown flag ${flag}`);
  }
  if (!Number.isInteger(args.runs) || args.runs < 1) throw new Error('--runs must be a positive integer');
  return args;
}

// D11 bands (brief acceptance 3) and the checks the achievements slice relies on.
export const D11_MEDIAN_BANDS = Object.freeze({ novice: [2, 4], intermediate: [4, 6], expert: [6, 8], hardcore: [8, 12], exceptional: [10, 14] });
export function acceptanceOf(profiles) {
  const checks = [];
  const check = (name, pass, value) => checks.push({ name, pass: Boolean(pass), value });
  for (const [name, [low, high]] of Object.entries(D11_MEDIAN_BANDS)) {
    const median = profiles[name]?.survivalMinutes?.p50;
    check(`${name} median survival ${low}-${high} min`, median >= low && median <= high, median);
  }
  check('novice p10 at least 1.0 min', profiles.novice?.survivalMinutes.p10 >= 1, profiles.novice?.survivalMinutes.p10);
  check('exceptional at most 10% of runs over 15 min', profiles.exceptional?.over15MinutesFraction <= 0.1, profiles.exceptional?.over15MinutesFraction);
  check('hardcore at most 2% of runs over 15 min', profiles.hardcore?.over15MinutesFraction <= 0.02, profiles.hardcore?.over15MinutesFraction);
  check('median hardcore run reaches region index 6 (coast) in loop 0', profiles.hardcore?.loop0RegionIndexReached?.p50 === 6, profiles.hardcore?.loop0RegionIndexReached?.p50);
  const fastest = Math.max(...Object.values(profiles).map((p) => p.flapsPerMinute.p99));
  check('12,000-flap cap >= 1.25 x 60 x fastest p99 flaps per minute', 12_000 >= 1.25 * 60 * fastest, Math.round(1.25 * 60 * fastest));
  return { pass: checks.every((c) => c.pass), checks };
}

// The "hover at y <= 100" exploit (scripts/chikun-course-pilot.mjs coursePilot), 16 seeds.
export function hoverPilotSurvival(seeds = 16) {
  const minutes = [];
  const causes = {};
  for (let seed = 1; seed <= seeds; seed += 1) {
    const runtime = createChikunRuntime({ seed, maxTicks: 216_000 });
    while (!runtime.terminal) runtime.step({ flap: coursePilot(runtime.snapshot()) });
    const result = runtime.result();
    minutes.push(result.survivalTicks / TICKS_PER_MINUTE);
    causes[result.finalState.terminalReason] = (causes[result.finalState.terminalReason] ?? 0) + 1;
  }
  minutes.sort((a, b) => a - b);
  return { seeds, medianMinutes: percentile(minutes, 0.5), maxMinutes: percentile(minutes, 1), causes };
}

// tests/fixtures/chikun-v6-replays.json: three bot runs on the v6 course, one of
// them near-miss heavy (a bot that also rewards skimming inside the 32 px band).
export const V6_FIXTURE_RUNS = Object.freeze([
  Object.freeze({ profile: 'intermediate', seedIndex: 5, skim: 0 }),
  Object.freeze({ profile: 'hardcore', seedIndex: 1, skim: 0 }),
  Object.freeze({ profile: 'expert', seedIndex: 3, skim: 800 }),
]);
export function recordV6Fixtures() {
  const runs = V6_FIXTURE_RUNS.map(({ profile, seedIndex, skim }) => {
    const record = playBotRun({ profileName: profile, seed: harnessSeed(seedIndex), maxTicks: 216_000, skim, keepResult: true });
    return { profile, seed: record.seed, skim, evidence: record.result.evidence, result: record.result };
  });
  return { version: 'chikun-v6-replay-fixtures-1', note: 'Bot runs on the v6 course (chikun-flap-evidence-v6, cabinet 0.9.0). Regenerate with node scripts/chikun-difficulty-harness.mjs --v6-fixtures after a deliberate course change (and bump the evidence version).', runs };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.fixtures) {
    const doc = recordV6Fixtures();
    writeFileSync('tests/fixtures/chikun-v6-replays.json', `${JSON.stringify(doc)}\n`);
    for (const run of doc.runs) console.log(`${run.profile} seed ${run.seed}: ${(run.result.survivalTicks / TICKS_PER_MINUTE).toFixed(2)} min, ${run.result.finalState.terminalReason}, near misses ${run.result.nearMisses}`);
    return;
  }
  const started = Date.now();
  const options = { runs: args.runs, capMinutes: args.capMinutes, courseKey: args.courseKey };
  if (args.profiles) options.profiles = args.profiles;
  if (args.workers) options.workers = args.workers;
  const { maxTicks, byProfile } = await runHarness(options);
  const summary = Object.fromEntries(Object.entries(byProfile).map(([name, records]) => [name, summarizeProfile(records)]));
  const elapsedSeconds = Math.round((Date.now() - started) / 100) / 10;
  for (const [name, s] of Object.entries(summary)) {
    console.log(`${name.padEnd(12)} p10 ${s.survivalMinutes.p10} p50 ${s.survivalMinutes.p50} p90 ${s.survivalMinutes.p90} p99 ${s.survivalMinutes.p99} >15m ${s.over15MinutesFraction} flaps/min p50 ${s.flapsPerMinute.p50} p99 ${s.flapsPerMinute.p99} causes ${JSON.stringify(s.deathCauses)}`);
  }
  console.log(`elapsed ${elapsedSeconds}s`);
  if (!args.write) return;
  const previous = existsSync(args.out) ? JSON.parse(readFileSync(args.out, 'utf8')) : null;
  const section = { command: `node scripts/chikun-difficulty-harness.mjs ${process.argv.slice(2).join(' ')}`.trim(), runsPerProfile: args.runs, capMinutes: args.capMinutes, maxTicks, elapsedSeconds, profiles: summary };
  if (args.baseline) {
    const doc = previous ?? { version: HARNESS_VERSION };
    doc.baseline = { course: args.courseKey === 'v5' ? 'chikun-flap-evidence-v5 (frozen v5 course, cabinet 0.8.0)' : CHIKUN_EVIDENCE_VERSION, ...section };
    writeFileSync(args.out, `${JSON.stringify(doc, null, 2)}\n`);
    return;
  }
  const hoverPilot = hoverPilotSurvival();
  const acceptance = acceptanceOf(summary);
  acceptance.checks.push({ name: 'hover pilot (coursePilot) median under 4 min across 16 seeds', pass: hoverPilot.medianMinutes < 4, value: hoverPilot.medianMinutes });
  acceptance.pass = acceptance.checks.every((c) => c.pass);
  console.log(`acceptance ${acceptance.pass ? 'PASS' : 'FAIL'} ${JSON.stringify(acceptance.checks.filter((c) => !c.pass))}`);
  const doc = {
    version: HARNESS_VERSION,
    course: { evidenceVersion: CHIKUN_EVIDENCE_VERSION, runtimeVersion: CHIKUN_RUNTIME_VERSION, cabinetVersion: CHIKUN_CABINET_VERSION, speedRamp: SPEED_RAMP, speedSlopeUnit: SPEED_SLOPE_UNIT, speedByMinute: Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 30, 60].map((m) => [m, speedAtTick(m * TICKS_PER_MINUTE)])) },
    seeds: 'run i of every profile uses harnessSeed(i) = (imul(i + 1, 0x9e3779b1) ^ 0x2545f491) >>> 0',
    botModel: 'scripts/lib/chikun-bots.mjs: delayed, viewport-filtered perception; exact self-prediction from its own presses; beam search over target heights robust to +/- round(sigma) ticks; presses land at T + round(N(0, sigma)); one press in flight, presses >= 6 ticks apart; cruise at y 480 when nothing is in sight.',
    botProfiles: CHIKUN_BOT_PROFILES,
    botChanges: previous?.botChanges ?? [],
    ...section,
    hoverPilot,
    acceptance,
    baseline: previous?.baseline ?? null,
  };
  writeFileSync(args.out, `${JSON.stringify(doc, null, 2)}\n`);
}

if (!isMainThread) {
  parentPort.on('message', (task) => {
    try {
      parentPort.postMessage({ id: task.id, record: playBotRun(task) });
    } catch (error) {
      parentPort.postMessage({ id: task.id, error: error instanceof Error ? error.stack : String(error) });
    }
  });
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
