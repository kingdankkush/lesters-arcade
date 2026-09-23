// Builds the achievement test fixtures (achievements slice, contract §6.3).
//
//   node tests/fixtures/achievements/build-fixtures.mjs
//     hmh-run-summary.json   ranked HMH summaries built with the real sdk accumulator
//     chikun-v6-result.json  v6 evidence and its canonical replay result
//     stacked-tuple.json     SIC1 evidence (base64) and its replayed result tuple
//
//   node tests/fixtures/achievements/build-fixtures.mjs --calibrate   (several minutes)
//     stacked-calibration.json       throttled soak-pilot profiles (STACKED thresholds)
//     chikun-skim-calibration.json   near-miss-chasing Chikun bots (combo and near-miss thresholds)
//
// Everything is seeded; re-running either mode rewrites byte-identical files.
import { writeFileSync, readFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import {
  createRunSummaryAccumulator, finalizeRunSummary, recordRunCollectible, recordRunDamage,
  recordRunGrenade, recordRunKill, recordRunTick, recordRunWeaponEvent,
} from '../../../sdk/hmh-run-summary.mjs';
import { validateRunSummaryPayload } from '../../../sdk/hmh-run-summary-schema.mjs';
import { replayChikunRun } from '../../../apps/portal/src/chikun-cabinet.mjs';
import {
  cellsFor, collides, createStackedInputRecorder, createStackedRuntime, replayStackedRun, zoneForTick,
} from '../../../apps/portal/src/stacked-sim.mjs';
import { createStackedSoakPilot } from '../../../apps/stacked/src/dev/soak-pilot.mjs';

const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const writeJson = (name, value) => writeFileSync(here(name), `${JSON.stringify(value, null, 2)}\n`);

// ---------------------------------------------------------------------------
// Hard Money Heroes: ranked summaries through createRunSummaryAccumulator,
// recordRunKill, recordRunGrenade, recordRunCollectible and finalizeRunSummary.
export const HMH_BUILD_HASH = 'site-1.7.0:game-1.7.0';
export const HMH_PLANS = Object.freeze({
  // A full Level 1 run: all six districts, the Liquidator down, a 34-kill combo.
  'boss-run': {
    seed: 3141592653, heroId: 'lit-commando', minutes: 22.5,
    districts: ['frontier-relay', 'rugpull-ravine', 'liquidity-crossing', 'hashwood', 'mining-camp', 'liquidation-yard'],
    weapons: ['coin-blaster', 'scatter-shotgun', 'hash-rail', 'litecoin-knife'],
    kills: [
      ['bagholder-rusher', 'coin-blaster', 96], ['bagholder-rusher', 'scatter-shotgun', 30], ['forkrunner', 'coin-blaster', 70],
      ['liquidator-agent', 'hash-rail', 50], ['validator-cultist', 'hash-rail', 25], ['gas-bomber', 'coin-blaster', 40],
      ['whale-enforcer', 'scatter-shotgun', 30, { elite: true }], ['whale-enforcer', 'litecoin-knife', 12], ['gas-bomber', 'satoshi-frag', 24],
      ['liquidator', 'hash-rail', 1, { boss: true }],
    ],
    grenadesThrown: 40,
    collectibles: { 'litecoin-token': 180, 'bonus-life': 1, 'scatter-shotgun-cache': 2, 'hash-rail-core': 1, 'time-dilation': 2, 'berserk-candle': 1 },
    damageDealt: 51_000, damageTaken: 1450, killedBy: 'enemy-whale-enforcer',
    score: 78_400, level: 26, maxCombo: 34, revealed: [610, 900], bossEngagedTick: 72_060,
  },
  // A short opening run: two districts, no grenades, one pickup.
  'short-run': {
    seed: 271828182, heroId: 'lilly', minutes: 4.5,
    districts: ['frontier-relay', 'rugpull-ravine'],
    weapons: ['coin-blaster'],
    kills: [['bagholder-rusher', 'coin-blaster', 25], ['forkrunner', 'coin-blaster', 13]],
    grenadesThrown: 0,
    collectibles: { 'litecoin-token': 20, 'bonus-life': 1 },
    damageDealt: 1_900, damageTaken: 300, killedBy: 'enemy-forkrunner',
    score: 4_200, level: 5, maxCombo: 6, revealed: [140, 900], bossEngagedTick: 0,
  },
  // A throwable-heavy mid run: four districts, grenade and melee kills, a 20k damage run.
  'grenade-run': {
    seed: 1618033988, heroId: 'lester-original', minutes: 12.25,
    districts: ['frontier-relay', 'rugpull-ravine', 'liquidity-crossing', 'hashwood'],
    weapons: ['coin-blaster', 'launcher-rig', 'forked-standard', 'litecoin-knife'],
    kills: [
      ['bagholder-rusher', 'coin-blaster', 50], ['forkrunner', 'coin-blaster', 30], ['liquidator-agent', 'launcher-rig', 7],
      ['validator-cultist', 'satoshi-frag', 15], ['gas-bomber', 'coin-blaster', 20], ['whale-enforcer', 'forked-standard', 8],
      ['forkrunner', 'litecoin-knife', 10], ['liquidator-agent', 'coin-blaster', 10],
    ],
    grenadesThrown: 30,
    collectibles: { 'litecoin-token': 95, 'launcher-rig-cache': 1, 'forked-standard-cache': 1, 'time-dilation': 1 },
    damageDealt: 21_500, damageTaken: 980, killedBy: 'enemy-gas-bomber',
    score: 26_300, level: 15, maxCombo: 16, revealed: [420, 900], bossEngagedTick: 0,
  },
  // A summary with no player damage (defeat not attributed). The whole-run
  // no-damage flag it carries never occurs in a real ranked run, which always
  // ends with the player's health at zero; it proves no-damage ids stay unearned.
  'untouched-run': {
    seed: 1414213562, heroId: 'lit-commando', minutes: 10.5,
    districts: ['frontier-relay', 'rugpull-ravine', 'liquidity-crossing'],
    weapons: ['coin-blaster', 'scatter-shotgun'],
    kills: [['bagholder-rusher', 'coin-blaster', 60], ['forkrunner', 'scatter-shotgun', 30], ['gas-bomber', 'coin-blaster', 10]],
    grenadesThrown: 0,
    collectibles: { 'litecoin-token': 60, 'scatter-shotgun-cache': 1 },
    damageDealt: 9_400, damageTaken: 0, killedBy: null,
    score: 16_800, level: 12, maxCombo: 12, revealed: [300, 900], bossEngagedTick: 0,
  },
});

export function buildHmhSummary(plan) {
  const endTick = Math.round(plan.minutes * 3600);
  const acc = createRunSummaryAccumulator({ seed: plan.seed, buildHash: HMH_BUILD_HASH, mode: 'ranked', heroId: plan.heroId, startTick: 0, startPosition: { x: 0, y: 0 } });
  const step = 60;
  const districtSpan = Math.floor(endTick / plan.districts.length);
  const weaponSpan = Math.floor(endTick / plan.weapons.length);
  for (const weaponId of plan.weapons.slice(1)) recordRunWeaponEvent(acc, { type: 'pickup', weaponId });
  for (let tick = step; tick < endTick; tick += step) {
    recordRunTick(acc, {
      tick,
      position: { x: tick / 8, y: (tick % 600) / 4 },
      activeWeaponId: plan.weapons[Math.min(plan.weapons.length - 1, Math.floor(tick / weaponSpan))],
      districtId: plan.districts[Math.min(plan.districts.length - 1, Math.floor(tick / districtSpan))],
      level: 1 + Math.floor((plan.level - 1) * tick / endTick),
      bossEngaged: plan.bossEngagedTick > 0 && tick >= plan.bossEngagedTick,
    });
  }
  for (const [enemyRoleId, weaponId, count, flags = {}] of plan.kills) {
    for (let i = 0; i < count; i += 1) recordRunKill(acc, { enemyRoleId, weaponId, elite: flags.elite === true, boss: flags.boss === true });
  }
  for (let i = 0; i < plan.grenadesThrown; i += 1) {
    recordRunGrenade(acc, { type: 'thrown' });
    recordRunGrenade(acc, { type: 'detonated', contacts: 2 });
  }
  for (const [effectId, count] of Object.entries(plan.collectibles)) {
    for (let i = 0; i < count; i += 1) recordRunCollectible(acc, { effectId });
  }
  // Damage dealt, spread over the run's weapons in whole hits.
  const perWeapon = Math.floor(plan.damageDealt / plan.weapons.length);
  plan.weapons.forEach((weaponId, index) => {
    const amount = index === plan.weapons.length - 1 ? plan.damageDealt - perWeapon * index : perWeapon;
    recordRunDamage(acc, { targetId: `enemy-${index}`, sourceId: 'player', weaponId, damageApplied: amount, healthBefore: amount });
  });
  if (plan.damageTaken > 0) {
    recordRunDamage(acc, { targetId: 'player', sourceId: 'enemy-1', weaponId: plan.killedBy, damageApplied: plan.damageTaken - 40, equippedWeaponId: plan.weapons[0], tick: endTick - 600 });
    recordRunDamage(acc, { targetId: 'player', sourceId: 'enemy-2', weaponId: plan.killedBy, damageApplied: 40, equippedWeaponId: plan.weapons.at(-1), killed: true, tick: endTick });
  }
  const summary = finalizeRunSummary(acc, {
    endTick, elapsedMs: endTick * 1000 / 60, terminalReason: 'defeated', score: plan.score, level: plan.level,
    xp: 150 * (plan.level - 1) * plan.level + 75, currentCombo: 0, maxCombo: plan.maxCombo,
    revealedCells: plan.revealed[0], totalCells: plan.revealed[1],
  });
  const error = validateRunSummaryPayload(summary);
  if (error) throw new Error(`fixture summary is invalid: ${error}`);
  return summary;
}

// ---------------------------------------------------------------------------
// STACKED: the soak pilot throttled to human speeds, with seeded misplacements.
// thinkTicks: pause after each spawn; gapTicks: pause after each input;
// errorPct: chance a hard drop is preceded by a one-column slip.
export const STACKED_PROFILES = Object.freeze([
  Object.freeze({ name: 'novice', thinkTicks: 45, gapTicks: 8, errorPct: 12 }),
  Object.freeze({ name: 'intermediate', thinkTicks: 30, gapTicks: 6, errorPct: 6 }),
  Object.freeze({ name: 'expert', thinkTicks: 22, gapTicks: 5, errorPct: 3 }),
  Object.freeze({ name: 'hardcore', thinkTicks: 14, gapTicks: 4, errorPct: 2 }),
  Object.freeze({ name: 'exceptional', thinkTicks: 10, gapTicks: 3, errorPct: 1 }),
]);
export const STACKED_BUILD_HASH = 'site-1.7.0:game-1.7.0:cabinet-0.2.0';
const STACKED_CONFIG = Object.freeze({ startLevel: 1, buildHash: STACKED_BUILD_HASH, seasonId: 'stacked-season-preview-1' });
const calibrationSeed = (index) => (Math.imul(index + 1, 0x9e3779b1) ^ 0x5bd1e995) >>> 0;

function xorshift(seed) {
  let state = (Math.imul(seed, 2654435761) >>> 0) || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}

export function playStackedProfile({ profile, seed, maxTicks, record = false }) {
  const runtime = createStackedRuntime({ seed, maxTicks, config: STACKED_CONFIG });
  const pilot = createStackedSoakPilot({ mode: 'free' });
  const recorder = record ? createStackedInputRecorder({ seed }) : null;
  const roll = xorshift(seed ^ 0x2545f491);
  let piece = -1, wait = 0, queued = [];
  while (!runtime.terminal) {
    const state = runtime.snapshot();
    if (state.piecesSpawned !== piece) { piece = state.piecesSpawned; wait = profile.thinkTicks; queued = []; }
    let mask = 0;
    if (wait > 0) wait -= 1;
    else if (queued.length > 0) {
      mask = queued.shift();
      if (mask !== 0 && mask === state.prevMask) { queued.unshift(mask); mask = 0; } else if (mask !== 0) wait = profile.gapTicks;
    } else {
      mask = pilot.sample(state);
      if ((mask & 8) !== 0 && state.active && roll() * 100 < profile.errorPct) {
        const dx = roll() < 0.5 ? -1 : 1;
        if (!collides(state.board, cellsFor(state.active.kind, state.active.rotation, state.active.x + dx, state.active.y))) {
          mask = dx < 0 ? 1 : 2;
          queued = [0, 8];
        }
      }
      if (mask !== 0) wait = profile.gapTicks;
    }
    if (recorder) { recorder.sample(recorder.tick + 1, mask); runtime.step(recorder.commit()); } else runtime.step(mask);
  }
  return { tuple: runtime.result(), evidence: recorder ? recorder.encode() : null };
}

// ---------------------------------------------------------------------------
// Percentiles (linear interpolation, like the Chikun harness).
function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const at = (sorted.length - 1) * p, lo = Math.floor(at), hi = Math.min(sorted.length - 1, lo + 1);
  return Math.round((sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo)) * 1000) / 1000;
}
const summarize = (rows, keys) => Object.fromEntries(keys.map((key) => {
  const values = rows.map((row) => row[key]).filter(Number.isFinite);
  return [key, { p10: percentile(values, 0.1), p50: percentile(values, 0.5), p90: percentile(values, 0.9), p99: percentile(values, 0.99) }];
}));

const STACKED_KEYS = ['survivalMinutes', 'lines', 'level', 'score', 'quadClears', 'spins', 'perfectClears', 'maxCombo', 'maxBackToBack', 'garbageRowsReceived', 'garbageRowsCleared', 'pieces', 'zone'];
const CHIKUN_SKIM_KEYS = ['survivalMinutes', 'nearMisses', 'nearMissStreakBest', 'bestCombo', 'flawlessRegions', 'coinsCollected', 'forksPassed', 'score', 'laps'];
export const STACKED_CALIBRATION_RUNS = 30;
export const STACKED_CALIBRATION_MAX_TICKS = 108_000;
export const CHIKUN_SKIM_RUNS = 40;
export const CHIKUN_SKIM = 800;

function stackedCalibrationRow(profile, index) {
  const seed = calibrationSeed(index);
  const { tuple } = playStackedProfile({ profile, seed, maxTicks: STACKED_CALIBRATION_MAX_TICKS });
  return {
    seed, survivalMinutes: tuple.ticks / 3600, lines: tuple.lines, level: tuple.level, score: tuple.score,
    quadClears: tuple.quadClears, spins: tuple.spins, perfectClears: tuple.perfectClears, maxCombo: tuple.maxCombo,
    maxBackToBack: tuple.maxBackToBack, garbageRowsReceived: tuple.garbageRowsReceived, garbageRowsCleared: tuple.garbageRowsCleared,
    pieces: tuple.pieces, zone: zoneForTick(tuple.ticks), terminalReason: tuple.terminalReason,
  };
}

async function runJobs(jobs, poolSize) {
  const workers = Math.max(1, Math.min(jobs.length, poolSize));
  const results = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: workers }, () => new Promise((resolve, reject) => {
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { worker: true } });
    const feed = () => {
      if (next >= jobs.length) { worker.terminate().then(resolve, reject); return; }
      const id = next++;
      worker.postMessage({ id, job: jobs[id] });
    };
    worker.on('message', ({ id, row, error }) => {
      if (error) { reject(new Error(error)); return; }
      results[id] = row;
      feed();
    });
    worker.on('error', reject);
    feed();
  })));
  return results;
}

async function calibrate() {
  const started = Date.now();
  const { runPool, harnessSeed } = await import('../../../scripts/chikun-difficulty-harness.mjs');
  const pool = Math.max(2, Math.min(24, cpus().length - 2));
  const stackedJobs = STACKED_PROFILES.flatMap((profile) => Array.from({ length: STACKED_CALIBRATION_RUNS }, (_, index) => ({ profile, index })));
  const skimProfiles = ['novice', 'intermediate', 'expert', 'hardcore', 'exceptional'];
  const skimJobs = skimProfiles.flatMap((profileName, weight) => Array.from({ length: CHIKUN_SKIM_RUNS }, (_, index) => ({ profileName, seed: harnessSeed(index), maxTicks: 216_000, skim: CHIKUN_SKIM, weight })));
  const [stackedRows, skimRecords] = await Promise.all([
    runJobs(stackedJobs, Math.ceil(pool / 2)),
    runPool(skimJobs, Math.floor(pool / 2)),
  ]);
  const skimRows = skimRecords.map((run) => ({ seed: run.seed, survivalMinutes: run.minutes, ...run.stats, terminalReason: run.terminalReason }));
  const reasons = (list) => list.reduce((out, row) => ({ ...out, [row.terminalReason]: (out[row.terminalReason] ?? 0) + 1 }), {});
  writeJson('stacked-calibration.json', {
    version: 'stacked-achievement-calibration-v1',
    model: 'apps/stacked/src/dev/soak-pilot.mjs (Free-only lookahead pilot) throttled to human speed: after each spawn it waits thinkTicks, after each input gapTicks, and errorPct of hard drops are preceded by a one-column slip. The pilot plays for singles; it never sets up Halvings, spins, perfect clears or back-to-back chains, so those thresholds are anchored on the Free medals (apps/stacked/src/free-medals.mjs) instead.',
    command: 'node tests/fixtures/achievements/build-fixtures.mjs --calibrate',
    runsPerProfile: STACKED_CALIBRATION_RUNS,
    maxTicks: STACKED_CALIBRATION_MAX_TICKS,
    seeds: 'run i uses (imul(i + 1, 0x9e3779b1) ^ 0x5bd1e995) >>> 0',
    config: STACKED_CONFIG,
    profiles: Object.fromEntries(STACKED_PROFILES.map((profile) => {
      const own = stackedRows.filter((_, i) => stackedJobs[i].profile.name === profile.name);
      return [profile.name, { ...profile, terminalReasons: reasons(own), stats: summarize(own, STACKED_KEYS) }];
    })),
  });
  writeJson('chikun-skim-calibration.json', {
    version: 'chikun-skim-calibration-v1',
    model: `scripts/chikun-difficulty-harness.mjs playBotRun with skim ${CHIKUN_SKIM}: the harness bot profiles, rewarded for passing inside the 32 px near-miss band. The harness JSON bots never aim for near misses; this sample is the near-miss-chasing strategy, which trades survival for near misses and combo.`,
    command: 'node tests/fixtures/achievements/build-fixtures.mjs --calibrate',
    runsPerProfile: CHIKUN_SKIM_RUNS,
    skim: CHIKUN_SKIM,
    seeds: 'run i uses harnessSeed(i) of scripts/chikun-difficulty-harness.mjs (the harness JSON runs 0-39)',
    profiles: Object.fromEntries(skimProfiles.map((name) => {
      const own = skimRows.filter((_, i) => skimJobs[i].profileName === name);
      return [name, { terminalReasons: reasons(own), stats: summarize(own, CHIKUN_SKIM_KEYS) }];
    })),
  });
  console.log(`calibration written in ${Math.round((Date.now() - started) / 1000)} s`);
}

function buildFixtures() {
  writeJson('hmh-run-summary.json', {
    version: 'achievements-hmh-run-summaries-v1',
    note: 'Ranked HMH run summaries built with sdk/hmh-run-summary.mjs. Regenerate with node tests/fixtures/achievements/build-fixtures.mjs.',
    runs: Object.fromEntries(Object.entries(HMH_PLANS).map(([name, plan]) => [name, buildHmhSummary(plan)])),
  });

  const v6 = JSON.parse(readFileSync(here('../chikun-v6-replays.json'), 'utf8'));
  writeJson('chikun-v6-result.json', {
    version: 'achievements-chikun-v6-results-v1',
    note: 'v6 evidence from tests/fixtures/chikun-v6-replays.json and its canonical replayChikunRun result. Regenerate with node tests/fixtures/achievements/build-fixtures.mjs.',
    runs: Object.fromEntries(v6.runs.map((run) => [`${run.profile}${run.skim ? '-skim' : ''}`, { profile: run.profile, skim: run.skim, evidence: run.evidence, result: replayChikunRun(run.evidence) }])),
  });

  const profile = STACKED_PROFILES.find((entry) => entry.name === 'intermediate');
  const seed = calibrationSeed(0);
  const { tuple, evidence } = playStackedProfile({ profile, seed, maxTicks: STACKED_CALIBRATION_MAX_TICKS, record: true });
  const replayed = replayStackedRun(evidence, { expectedSeed: seed, maxTicks: STACKED_CALIBRATION_MAX_TICKS, config: STACKED_CONFIG });
  if (JSON.stringify(replayed) !== JSON.stringify(tuple)) throw new Error('STACKED fixture does not replay to its own tuple');
  writeJson('stacked-tuple.json', {
    version: 'achievements-stacked-tuple-v1',
    note: 'An intermediate-profile throttled soak-pilot run (see stacked-calibration.json). Regenerate with node tests/fixtures/achievements/build-fixtures.mjs.',
    seed, maxTicks: STACKED_CALIBRATION_MAX_TICKS, config: STACKED_CONFIG,
    evidenceBase64: Buffer.from(evidence).toString('base64'),
    tuple,
  });
  console.log('fixtures written');
}

if (!isMainThread && workerData?.worker) {
  parentPort.on('message', ({ id, job }) => {
    try {
      parentPort.postMessage({ id, row: stackedCalibrationRow(job.profile, job.index) });
    } catch (error) {
      parentPort.postMessage({ id, error: error instanceof Error ? error.stack : String(error) });
    }
  });
} else if (isMainThread && process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (process.argv.includes('--calibrate')) await calibrate();
  else buildFixtures();
}
