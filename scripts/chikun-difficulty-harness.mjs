// Chikun difficulty harness (chikun-tune slice, decision D11).
//
// Plays seeded headless runs for each bot profile in scripts/lib/chikun-bots.mjs
// on the pure runtime and reports survival percentiles, death causes, stat
// percentiles and flap rates. Usage:
//   node scripts/chikun-difficulty-harness.mjs --runs 200            # writes the QA JSON
//   node scripts/chikun-difficulty-harness.mjs --runs 16 --no-write  # quick sample
//   node scripts/chikun-difficulty-harness.mjs --course v5 --baseline --runs 200 --cap-minutes 30
//   node scripts/chikun-difficulty-harness.mjs --sensitivity --runs 48   # cruise-height sensitivity
// Options: --profiles a,b  --cap-minutes N (default 60)  --workers N  --out <path>
// Seeds are fixed: run i of every profile uses harnessSeed(i). The worker pool
// defaults to min(16, cores - 2); the JSON records the machine and pool size.
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { availableParallelism, cpus } from 'node:os';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as liveCourse from '../apps/portal/src/chikun-ground-course.mjs';
import * as v5Course from '../apps/portal/src/chikun-ground-v5-course.mjs';
import * as liveRuntime from '../apps/portal/src/chikun-ground-runtime.mjs';
import { resolve } from 'node:path';
import { createChikunRuntime, flapTicksOf, CHIKUN_EVIDENCE_VERSION, CHIKUN_RUNTIME_VERSION, CHIKUN_CABINET_VERSION } from '../apps/portal/src/chikun-cabinet.mjs';
import { CHIKUN_BOT_CRUISE_RANGE, CHIKUN_BOT_PROFILES, CHIKUN_V5_PHYSICS, botProfile, createChikunBot, createVisiblePilot } from './lib/chikun-bots.mjs';
import { coursePilot, routePilot } from './chikun-course-pilot.mjs';
import { CHIKUN_PREVIEW_PX, CHIKUN_PREVIEW_TICKS } from '../apps/chikun/src/viewport.mjs';
import { regionForObstacle } from '../apps/portal/src/chikun-course-regions.mjs';
const { SPEED_RAMP, SPEED_SLOPE_UNIT, DIFFICULTY_RAMP_START, DIFFICULTY_RAMP_SLOTS, speedAtTick } = liveCourse;

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

// The obstacle a run ended at: the impact obstacle, or for a fall the gap under Chikun.
function deathIndexOf(snapshot) {
  if (Number.isInteger(snapshot.impact?.index)) return snapshot.impact.index;
  const under = snapshot.forks.find((o) => o.family === 'gap' && 280 > o.x && 280 < o.x + o.width);
  return under ? under.index : null;
}

// One seeded run. Throws from the runtime are recorded as terminalReason 'flap-cap'.
export function playBotRun({ profileName, seed, maxTicks, courseKey = 'live', skim = 0, keepResult = false, cruiseY = null }) {
  const { course, physics, evidenceVersion } = COURSES[courseKey]();
  const profile = botProfile(profileName);
  const runtime = createChikunRuntime({ seed, maxTicks, evidenceVersion });
  const bot = createChikunBot({ profile, seed, course, physics, skim, cruiseY });
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
  const terminalReason = thrown ? 'flap-cap' : result.finalState.terminalReason;
  const deathIndex = terminalReason === 'run-complete' || terminalReason === 'flap-limit' ? null : deathIndexOf(snapshot);
  let death = null;
  if (deathIndex !== null) {
    const { region, local, loop } = regionForObstacle(deathIndex);
    death = { index: deathIndex, region: region.id, local, loop };
  }
  return {
    profile: profileName,
    seed,
    survivalTicks: ticks,
    minutes: ticks / TICKS_PER_MINUTE,
    terminalReason,
    flaps,
    cruiseY: bot.cruiseY,
    markersSeen: bot.markersSeen,
    death,
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

// Scripted pilots (scripts/chikun-course-pilot.mjs) on the live course, 60-minute cap.
// `view` limits the pilot to what a player sees (createVisiblePilot, with a
// reaction delay); 'full' reads the whole runtime snapshot, off-screen obstacles
// included, which no player can see (a solver).
export const PILOT_RUNS = Object.freeze({
  coursePilot: Object.freeze({ pilot: 'coursePilot', view: 'full' }),
  routePilotLandscape: Object.freeze({ pilot: 'routePilot', view: 'landscape', delay: 8 }),
  routePilotPortrait: Object.freeze({ pilot: 'routePilot', view: 'portrait', delay: 12 }),
  routePilotFullSnapshot: Object.freeze({ pilot: 'routePilot', view: 'full' }),
});
const PILOTS = { coursePilot, routePilot };
export function pilotFor(name) {
  const spec = PILOT_RUNS[name];
  if (!spec) throw new Error(`Unknown Chikun pilot run: ${name}`);
  const base = PILOTS[spec.pilot];
  if (spec.view === 'landscape') return createVisiblePilot(base, { orientation: 'landscape', width: 1280, height: 720, delay: spec.delay });
  if (spec.view === 'portrait') return createVisiblePilot(base, { orientation: 'portrait', width: 390, height: 844, delay: spec.delay });
  return base;
}
export function playPilotRun({ name, seed, maxTicks = 216_000 }) {
  const pilot = pilotFor(name);
  const runtime = createChikunRuntime({ seed, maxTicks });
  while (!runtime.terminal) runtime.step({ flap: pilot(runtime.snapshot()) });
  const result = runtime.result();
  return { name, seed, minutes: result.survivalTicks / TICKS_PER_MINUTE, terminalReason: result.finalState.terminalReason, flaps: flapTicksOf(result.evidence).length };
}

export function summarizePilot(records) {
  const minutes = records.map((r) => r.minutes).sort((a, b) => a - b);
  const causes = {};
  for (const r of records) causes[r.terminalReason] = (causes[r.terminalReason] ?? 0) + 1;
  const flaps = records.reduce((sum, r) => sum + r.flaps, 0);
  const played = records.reduce((sum, r) => sum + r.minutes, 0);
  return {
    seeds: records.length,
    medianMinutes: percentile(minutes, 0.5),
    maxMinutes: percentile(minutes, 1),
    over15Minutes: records.filter((r) => r.minutes > 15).length,
    flapsPerMinute: Math.round(flaps / Math.max(1e-9, played) * 1000) / 1000,
    causes: Object.fromEntries(Object.entries(causes).sort((a, b) => b[1] - a[1])),
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
  // Where runs end: by region, and the most common obstacle slots (region#slot, lap).
  const byRegion = {};
  const bySlot = {};
  for (const r of records) {
    if (!r.death) continue;
    byRegion[r.death.region] = (byRegion[r.death.region] ?? 0) + 1;
    const key = `${r.death.region}#${r.death.local} lap ${r.death.loop + 1}`;
    bySlot[key] = (bySlot[key] ?? 0) + 1;
  }
  const markers = records.map((r) => r.markersSeen ?? 0).sort((a, b) => a - b);
  return {
    runs: records.length,
    survivalMinutes: Object.fromEntries([['p10', 0.1], ['p25', 0.25], ['p50', 0.5], ['p75', 0.75], ['p90', 0.9], ['p95', 0.95], ['p99', 0.99]].map(([k, p]) => [k, percentile(minutes, p)])),
    over15MinutesFraction: Math.round(records.filter((r) => r.minutes > 15).length / records.length * 1000) / 1000,
    deathCauses: Object.fromEntries(Object.entries(causes).sort((a, b) => b[1] - a[1])),
    deathRegions: Object.fromEntries(Object.entries(byRegion).sort((a, b) => b[1] - a[1])),
    topDeathSlots: Object.fromEntries(Object.entries(bySlot).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8)),
    stats,
    flapsPerMinute: { p50: percentile(rates, 0.5), p99: percentile(rates, 0.99) },
    loop0RegionIndexReached: loop0.length ? { p10: percentile(loop0, 0.1), p50: percentile(loop0, 0.5), p90: percentile(loop0, 0.9) } : null,
    portraitMarkersSeen: { p10: percentile(markers, 0.1), p50: percentile(markers, 0.5) },
  };
}

export const defaultWorkers = () => Math.max(1, Math.min(16, availableParallelism() - 2));

// Runs tasks on a worker pool; results come back in task order. A task is a bot
// run ({profileName, seed, ...}) or a pilot run ({pilotName, seed}). Heavier
// tasks (higher `weight`) start first so the pool stays busy.
export async function runPool(tasks, workers = defaultWorkers()) {
  const order = [...tasks.keys()].sort((a, b) => (tasks[b].weight ?? 0) - (tasks[a].weight ?? 0) || a - b);
  const results = new Array(tasks.length);
  const poolSize = Math.max(1, Math.min(workers, tasks.length));
  let next = 0;
  await Promise.all(Array.from({ length: poolSize }, () => new Promise((resolve, reject) => {
    const worker = new Worker(fileURLToPath(import.meta.url));
    const feed = () => {
      if (next >= order.length) { worker.terminate().then(resolve, reject); return; }
      const id = order[next++];
      worker.postMessage({ ...tasks[id], id });
    };
    worker.on('message', (message) => {
      if (message.error) { worker.terminate(); reject(new Error(message.error)); return; }
      results[message.id] = message.record;
      feed();
    });
    worker.on('error', reject);
    feed();
  })));
  return results;
}

// Every (profile, seed) bot run; output order is fixed.
export async function runHarness({ profiles = CHIKUN_BOT_PROFILES.map((p) => p.name), runs = 200, capMinutes = 60, courseKey = 'live', workers = defaultWorkers(), cruiseY = null } = {}) {
  const maxTicks = Math.min(216_000, Math.round(capMinutes * TICKS_PER_MINUTE));
  const tasks = [];
  for (const profileName of profiles) for (let i = 0; i < runs; i += 1) tasks.push({ profileName, seed: harnessSeed(i), maxTicks, courseKey, cruiseY, weight: profiles.indexOf(profileName) });
  const results = await runPool(tasks, workers);
  const byProfile = {};
  for (const profileName of profiles) byProfile[profileName] = results.filter((r) => r.profile === profileName);
  return { maxTicks, workers: Math.max(1, Math.min(workers, tasks.length)), byProfile };
}

// The scripted pilots of PILOT_RUNS on seeds 1..seeds.
export async function runPilots({ seeds = 16, workers = defaultWorkers(), names = Object.keys(PILOT_RUNS) } = {}) {
  const tasks = [];
  for (const name of names) for (let seed = 1; seed <= seeds; seed += 1) tasks.push({ pilotName: name, seed, weight: name === 'routePilotFullSnapshot' ? 10 : 1 });
  const results = await runPool(tasks, workers);
  return Object.fromEntries(names.map((name) => [name, summarizePilot(results.filter((r) => r.name === name))]));
}

function parseArgs(argv) {
  const args = { runs: 200, capMinutes: 60, courseKey: 'live', write: true, baseline: false, fixtures: false, sensitivity: false, profiles: null, workers: null, out: HARNESS_JSON };
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
    else if (flag === '--sensitivity') args.sensitivity = true;
    else throw new Error(`Unknown flag ${flag}`);
  }
  if (!Number.isInteger(args.runs) || args.runs < 1) throw new Error('--runs must be a positive integer');
  return args;
}

// D11 bands (brief acceptance 3) and the checks the achievements slice relies on.
export const D11_MEDIAN_BANDS = Object.freeze({ novice: [2, 4], intermediate: [4, 6], expert: [6, 8], hardcore: [8, 12], exceptional: [10, 14] });
export function acceptanceOf(profiles, pilots = null) {
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
  check('portrait bots read the in-game marker (median markers seen > 0)', ['novice', 'intermediate'].every((name) => profiles[name]?.portraitMarkersSeen?.p50 > 0), ['novice', 'intermediate'].map((name) => profiles[name]?.portraitMarkersSeen?.p50));
  // The cap must cover 60 minutes of the fastest bot and of hover play (a pilot
  // that flaps every time it sinks to hold its height).
  const fastestBot = Math.max(...Object.values(profiles).map((p) => p.flapsPerMinute.p99));
  const fastest = Math.max(fastestBot, ...Object.values(pilots ?? {}).map((p) => p.flapsPerMinute));
  check('12,000-flap cap >= 1.25 x 60 x fastest flaps per minute (bot p99 and hover pilots)', 12_000 >= 1.25 * 60 * fastest, Math.round(1.25 * 60 * fastest));
  if (pilots) {
    check('coursePilot (hover at y <= 100) median under 4 min across 16 seeds', pilots.coursePilot.medianMinutes < 4, pilots.coursePilot.medianMinutes);
    for (const name of ['routePilotLandscape', 'routePilotPortrait']) {
      check(`${name} (hover that dips under planes, on-screen information and a reaction delay) never passes 15 min and has a median of at most 12 min`, pilots[name].maxMinutes < 15 && pilots[name].medianMinutes <= 12, [pilots[name].medianMinutes, pilots[name].maxMinutes]);
    }
  }
  return { pass: checks.every((c) => c.pass), checks };
}

// Fingerprint of the live course: obstacle geometry for three seeds over three
// laps plus the speed and distance curve. The committed JSON records it and a
// test recomputes it, so a course change cannot leave a stale report behind.
export function courseDigest() {
  let hash = 0x811c9dc5;
  const feed = (text) => {
    for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619) >>> 0; }
  };
  for (const seed of [1, 7, 42]) {
    for (let index = 0; index < 144; index += 1) feed(JSON.stringify(liveCourse.buildCourseObstacle({ seed, index, tick: index * liveCourse.COURSE_CADENCE, x: 0 })));
  }
  for (let tick = 0; tick <= 216_000; tick += 1_800) feed(`${speedAtTick(tick)}|${liveCourse.distanceAtTick(tick)};`);
  return hash.toString(16).padStart(8, '0');
}

export function courseFacts() {
  return {
    evidenceVersion: CHIKUN_EVIDENCE_VERSION,
    runtimeVersion: CHIKUN_RUNTIME_VERSION,
    cabinetVersion: CHIKUN_CABINET_VERSION,
    speedRamp: SPEED_RAMP,
    speedSlopeUnit: SPEED_SLOPE_UNIT,
    speedByMinute: Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 30, 60].map((m) => [m, speedAtTick(m * TICKS_PER_MINUTE)])),
    geometryRamp: { startIndex: DIFFICULTY_RAMP_START, slots: DIFFICULTY_RAMP_SLOTS },
    lowPassages: 'seeded per region visit (chikun-course-regions.mjs lowSlotsOf), so the loop cannot be memorised',
    portraitPreview: { px: CHIKUN_PREVIEW_PX, ticks: CHIKUN_PREVIEW_TICKS, maxPx: 1000 },
    courseDigest: courseDigest(),
  };
}

// Bot-model corrections made after review (the profile table itself is unchanged).
export const BOT_MODEL_CHANGES = Object.freeze([
  Object.freeze({ change: 'Portrait bots read the in-game "<KIND> AHEAD" marker whatever their lookAheadPx.', reason: 'The marker is drawn at the right edge of the phone screen, inside every portrait look-ahead, so filtering it by look-ahead understated what portrait players see. The marker itself now previews at most 360 px ahead (50 ticks at speed, never past the landscape screen), so a phone never gets more warning than landscape play.' }),
  Object.freeze({ change: `Cruise height is drawn per run from ${CHIKUN_BOT_CRUISE_RANGE[0]}-${CHIKUN_BOT_CRUISE_RANGE[1]} px instead of a fixed 480 px.`, reason: 'One cruise constant decided which low passages were free (480 px sat 10 px under the shallowest low passage). A spread of habits keeps the percentiles from hinging on it; cruiseSensitivity reports the medians at fixed heights.' }),
]);

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
  const workers = args.workers ?? defaultWorkers();
  const environment = { cpus: availableParallelism(), cpuModel: cpus()[0]?.model?.trim() ?? 'unknown', workers, node: process.version, platform: process.platform };
  const command = `node scripts/chikun-difficulty-harness.mjs ${process.argv.slice(2).join(' ')}`.trim();
  if (args.sensitivity) {
    // Cruise-height sensitivity: every profile at three fixed cruise heights.
    const previous = JSON.parse(readFileSync(args.out, 'utf8'));
    const heights = {};
    for (const cruiseY of [420, 480, 540]) {
      const { byProfile } = await runHarness({ runs: args.runs, capMinutes: args.capMinutes, workers, cruiseY, ...(args.profiles ? { profiles: args.profiles } : {}) });
      heights[cruiseY] = Object.fromEntries(Object.entries(byProfile).map(([name, records]) => [name, summarizeProfile(records).survivalMinutes.p50]));
      console.log(`cruise ${cruiseY}: ${JSON.stringify(heights[cruiseY])}`);
    }
    previous.cruiseSensitivity = {
      command, runsPerProfile: args.runs, capMinutes: args.capMinutes,
      note: 'Median survival minutes with every run at one fixed cruise height instead of the per-run CHIKUN_BOT_CRUISE_RANGE draw.',
      medianMinutesByCruiseY: heights,
      elapsedSeconds: Math.round((Date.now() - started) / 100) / 10,
      environment,
    };
    writeFileSync(args.out, `${JSON.stringify(previous, null, 2)}\n`);
    return;
  }
  const options = { runs: args.runs, capMinutes: args.capMinutes, courseKey: args.courseKey, workers };
  if (args.profiles) options.profiles = args.profiles;
  const { maxTicks, byProfile } = await runHarness(options);
  const summary = Object.fromEntries(Object.entries(byProfile).map(([name, records]) => [name, summarizeProfile(records)]));
  for (const [name, s] of Object.entries(summary)) {
    console.log(`${name.padEnd(12)} p10 ${s.survivalMinutes.p10} p50 ${s.survivalMinutes.p50} p90 ${s.survivalMinutes.p90} p99 ${s.survivalMinutes.p99} >15m ${s.over15MinutesFraction} flaps/min p50 ${s.flapsPerMinute.p50} p99 ${s.flapsPerMinute.p99} causes ${JSON.stringify(s.deathCauses)}`);
  }
  const botSeconds = Math.round((Date.now() - started) / 100) / 10;
  console.log(`bots ${botSeconds}s`);
  if (!args.write) return;
  const previous = existsSync(args.out) ? JSON.parse(readFileSync(args.out, 'utf8')) : null;
  if (args.baseline) {
    const doc = previous ?? { version: HARNESS_VERSION };
    doc.baseline = { course: args.courseKey === 'v5' ? 'chikun-flap-evidence-v5 (frozen v5 course, cabinet 0.8.0)' : CHIKUN_EVIDENCE_VERSION, command, runsPerProfile: args.runs, capMinutes: args.capMinutes, maxTicks, elapsedSeconds: botSeconds, environment, profiles: summary };
    writeFileSync(args.out, `${JSON.stringify(doc, null, 2)}\n`);
    return;
  }
  const pilots = await runPilots({ workers });
  for (const [name, p] of Object.entries(pilots)) console.log(`${name.padEnd(24)} median ${p.medianMinutes} max ${p.maxMinutes} flaps/min ${p.flapsPerMinute} ${JSON.stringify(p.causes)}`);
  const elapsedSeconds = Math.round((Date.now() - started) / 100) / 10;
  console.log(`elapsed ${elapsedSeconds}s (bots ${botSeconds}s)`);
  const acceptance = acceptanceOf(summary, pilots);
  console.log(`acceptance ${acceptance.pass ? 'PASS' : 'FAIL'} ${JSON.stringify(acceptance.checks.filter((c) => !c.pass))}`);
  const doc = {
    version: HARNESS_VERSION,
    course: courseFacts(),
    seeds: 'run i of every profile uses harnessSeed(i) = (imul(i + 1, 0x9e3779b1) ^ 0x2545f491) >>> 0; pilots use seeds 1..16',
    botModel: `scripts/lib/chikun-bots.mjs: delayed, viewport-filtered perception (portrait bots also read the in-game "<KIND> AHEAD" marker drawn at the screen edge); exact self-prediction from its own presses; beam search over target heights robust to +/- round(sigma) ticks; presses land at T + round(N(0, sigma)); one press in flight, presses >= 6 ticks apart; with nothing in sight a bot cruises at a per-run height drawn from ${CHIKUN_BOT_CRUISE_RANGE[0]}-${CHIKUN_BOT_CRUISE_RANGE[1]} px (seeded, botCruiseY).`,
    assumptions: [
      'The bots do not memorise the course. Low passages are seeded per region visit, so there is nothing to memorise across seeds; only a daily-challenge seed replayed in Free practice can be learned.',
      'The D11 figures describe players who see what the screen shows. A pilot that reads the whole runtime snapshot (obstacles far past the screen edge) is a solver: pilots.routePilotFullSnapshot survives the hour, and contract section 12 accepts solver risk for the testnet launch.',
      'Deaths above expert still cluster where a high passage is followed by a low one at speed (see topDeathSlots). Seeded low passages and per-run cruise heights spread the percentiles, but achievement thresholds should be read from the p10-p90 range rather than one upper percentile.',
      `Bot-sample medians ran on ${availableParallelism()} logical CPUs with ${workers} workers; wall time scales roughly with 1 / workers.`,
    ],
    botProfiles: CHIKUN_BOT_PROFILES,
    botChanges: previous?.botChanges ?? [],
    botModelChanges: BOT_MODEL_CHANGES,
    command,
    runsPerProfile: args.runs,
    capMinutes: args.capMinutes,
    maxTicks,
    elapsedSeconds,
    botElapsedSeconds: botSeconds,
    environment,
    profiles: summary,
    hoverPilot: pilots.coursePilot,
    pilots,
    acceptance,
    cruiseSensitivity: previous?.cruiseSensitivity ?? null,
    baseline: previous?.baseline ?? null,
  };
  writeFileSync(args.out, `${JSON.stringify(doc, null, 2)}\n`);
}

if (!isMainThread) {
  parentPort.on('message', (task) => {
    try {
      parentPort.postMessage({ id: task.id, record: task.pilotName ? playPilotRun({ name: task.pilotName, seed: task.seed }) : playBotRun(task) });
    } catch (error) {
      parentPort.postMessage({ id: task.id, error: error instanceof Error ? error.stack : String(error) });
    }
  });
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
