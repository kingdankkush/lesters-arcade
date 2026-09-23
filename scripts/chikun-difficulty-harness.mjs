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
import { createChikunRuntime, CHIKUN_EVIDENCE_VERSION, CHIKUN_RUNTIME_VERSION, CHIKUN_CABINET_VERSION } from '../apps/portal/src/chikun-cabinet.mjs';
import { CHIKUN_BOT_PROFILES, CHIKUN_V5_PHYSICS, botProfile, createChikunBot } from './lib/chikun-bots.mjs';

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
export function playBotRun({ profileName, seed, maxTicks, courseKey = 'live' }) {
  const { course, physics, evidenceVersion } = COURSES[courseKey]();
  const profile = botProfile(profileName);
  const runtime = createChikunRuntime({ seed, maxTicks, evidenceVersion });
  const bot = createChikunBot({ profile, seed, course, physics });
  let thrown = null;
  try {
    while (!runtime.terminal) runtime.step({ flap: bot.decide(runtime.snapshot()) });
  } catch (error) {
    thrown = error instanceof Error ? error.message : String(error);
  }
  const snapshot = runtime.snapshot();
  const result = runtime.result();
  const ticks = result ? result.survivalTicks : snapshot.tick;
  const flaps = result ? flapCountOf(result.evidence) : bot.presses;
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
  };
}

function flapCountOf(evidence) {
  if (Array.isArray(evidence.flapSteps)) return evidence.flapSteps.length;
  return Array.isArray(evidence.flapDeltas) ? evidence.flapDeltas.length : 0;
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
  return {
    runs: records.length,
    survivalMinutes: Object.fromEntries([['p10', 0.1], ['p25', 0.25], ['p50', 0.5], ['p75', 0.75], ['p90', 0.9], ['p95', 0.95], ['p99', 0.99]].map(([k, p]) => [k, percentile(minutes, p)])),
    over15MinutesFraction: Math.round(records.filter((r) => r.minutes > 15).length / records.length * 1000) / 1000,
    deathCauses: Object.fromEntries(Object.entries(causes).sort((a, b) => b[1] - a[1])),
    stats,
    flapsPerMinute: { p50: percentile(rates, 0.5), p99: percentile(rates, 0.99) },
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
  const args = { runs: 200, capMinutes: 60, courseKey: 'live', write: true, baseline: false, profiles: null, workers: null, out: HARNESS_JSON };
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
    else throw new Error(`Unknown flag ${flag}`);
  }
  if (!Number.isInteger(args.runs) || args.runs < 1) throw new Error('--runs must be a positive integer');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
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
  const doc = {
    version: HARNESS_VERSION,
    course: { evidenceVersion: CHIKUN_EVIDENCE_VERSION, runtimeVersion: CHIKUN_RUNTIME_VERSION, cabinetVersion: CHIKUN_CABINET_VERSION },
    seeds: 'run i of every profile uses harnessSeed(i) = (imul(i + 1, 0x9e3779b1) ^ 0x2545f491) >>> 0',
    botProfiles: CHIKUN_BOT_PROFILES,
    botChanges: previous?.botChanges ?? [],
    ...section,
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
