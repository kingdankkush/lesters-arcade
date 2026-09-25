#!/usr/bin/env node
// Chikun plausibility calibration (design §B.4 protocol, §C.8; owner checkpoint OJ2; jackpot-server slice).
//
//   node scripts/chikun-plausibility-calibrate.mjs --probe [--bots N] [--seed-variance]
//        [--human-dir tests/fixtures/chikun-human-calibration] [--from-neon --vouched <file>]
//        [--cap-minutes M] [--pilot-seeds K] [--out <path> | --no-write]
//   node scripts/chikun-plausibility-calibrate.mjs --fixtures   # regenerates the jackpot-server replay fixtures
//
// Re-runs every hold rule of server/jackpot/plausibility.mjs over three NAMED populations and writes the
// QA receipt (default docs/qa/chikun-plausibility-calibration-<date>.json):
//   (a) must-hold set, GATED at 100% held: routePilot landscape and portrait (what a player sees),
//       routePilotFullSnapshot (the solver; seed 1 from the committed fixture), a maxTicks-truncated run
//       (a non-stock client, H7) and a late-evidence fixture (H9).
//   (b) known-evasion set, REPORTED (a miss is expected, not a failure): the exceptional bot on real seeds
//       (with --bots N), the committed humanised solver and the widened-view pilot
//       (scripts/lib/chikun-evasion-pilots.mjs). The receipt records their miss rates.
//   (c) human set: replay files (--human-dir; chikun-replay-file-v1, evidence only) and, read-only, live
//       Ranked rows from Neon (--from-neon) ONLY for wallets the owner vouches for (--vouched <file>: a
//       JSON array of addresses, { "wallets": [...] }, or one address per line). Every other Neon row is
//       reported separately and never enters a gate denominator. Wallets are never written to the receipt.
// --probe adds the B.4 probe table (bot human models from tests/fixtures/chikun-v6-replays.json plus
// --bots N harness runs per profile, reflex bots with 1-3-tick reactions, the scripted pilots, the solver,
// the humanised solver and the widened-view pilot). --seed-variance runs the fixed-seed, varied-noise
// pass (how much of the survival spread is the seed alone; B.5 item 4).
// --cap-minutes stops the scripted INPUTS at M minutes (the run then plays out with no presses, so its
// evidence stays stock and canonical); the committed receipt runs uncapped.
//
// The gate for JACKPOT_LIVE (design §B.4): 100% of (a) held; 0 human holds on H4-H6 with at least 40 human
// runs (15 of them 8 minutes or longer; at least 5 people, attested by the owner); every other rule's
// human hold rate recorded with its one-sided Clopper-Pearson 95% upper bound; (b) miss rates recorded.
// Nothing here touches the chain, and NEON_DATABASE_URL is read from the environment only, never printed.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as liveCourse from '../apps/portal/src/chikun-ground-course.mjs';
import { GROUND_PHYSICS } from '../apps/portal/src/chikun-ground-runtime.mjs';
import { createChikunRuntime, flapTicksOf } from '../apps/portal/src/chikun-cabinet.mjs';
import { createNeonClient } from '../apps/portal/src/server-neon.mjs';
import { importChikunReplay } from '../apps/chikun/src/replay-file.mjs';
import { PLAUSIBILITY_VERSION, STOCK_MAX_TICKS, THRESHOLDS, screenRun } from '../server/jackpot/plausibility.mjs';
import { CHIKUN_BOT_PROFILES, botProfile, createChikunBot } from './lib/chikun-bots.mjs';
import { EVASION_PILOT_VERSION, evasionPilotFor } from './lib/chikun-evasion-pilots.mjs';
import { harnessSeed, pilotFor } from './chikun-difficulty-harness.mjs';

export const CALIBRATION_VERSION = 'chikun-plausibility-calibration-v1';
export const HUMAN_GATE = Object.freeze({ minRuns: 40, minLongRuns: 15, longRunMinutes: 8, minPeople: 5, zeroHoldRules: Object.freeze(['H4', 'H5', 'H6']) });
export const HOLD_RULES = Object.freeze(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H10', 'H11']);
export const FIXTURE_PATHS = Object.freeze({
  botModels: 'tests/fixtures/chikun-v6-replays.json',
  solver: 'tests/fixtures/jackpot-server/run-complete-solver.json',
  widened: 'tests/fixtures/jackpot-server/widened-view-pilot.json',
});
export const REFLEX_REACTIONS = Object.freeze([1, 2, 3]);
const TICKS_PER_MINUTE = 3600;
const LATE_EVIDENCE_SECONDS = 1500;
const TRUNCATED_MAX_TICKS = 3 * TICKS_PER_MINUTE;
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// --- Statistics ------------------------------------------------------------------

function logChoose(n, k) {
  let out = 0;
  for (let i = 1; i <= k; i += 1) out += Math.log(n - k + i) - Math.log(i);
  return out;
}

function binomialCdf(k, n, p) {
  if (p <= 0) return 1;
  if (p >= 1) return k >= n ? 1 : 0;
  let sum = 0;
  for (let i = 0; i <= k; i += 1) sum += Math.exp(logChoose(n, i) + i * Math.log(p) + (n - i) * Math.log(1 - p));
  return Math.min(1, sum);
}

// One-sided Clopper-Pearson upper bound: the largest true rate with P(X ≤ k) ≥ 1 − confidence.
// 0 of 40 gives 0.072 (the design's "about 7.5%" is the rule of three, 3/40).
export function clopperPearsonUpper(k, n, confidence = 0.95) {
  if (!Number.isInteger(n) || n <= 0) return null;
  if (k >= n) return 1;
  const alpha = 1 - confidence;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    if (binomialCdf(k, n, mid) > alpha) low = mid;
    else high = mid;
  }
  return Number(high.toFixed(4));
}

const round = (value, places = 3) => (Number.isFinite(value) ? Number(value.toFixed(places)) : null);

// --- Screening one run -----------------------------------------------------------

// The pure part of the screen for one run: hold codes (plus H7 for a non-stock maxTicks or evidence the
// replay rejects) and the probe-table features. `row` adds Neon facts (opened/verified times for H9).
export function screenEvidence(evidence, { label, set, source, row = {}, orientation = 'landscape' } = {}) {
  const base = { label, set, source, orientation };
  let screened;
  try {
    screened = screenRun({ evidence, row, orientation });
  } catch (error) {
    return { ...base, codes: ['H7'], held: true, error: String(error?.message ?? error).slice(0, 120), features: null };
  }
  const codes = [...screened.codes];
  if (Number(evidence?.maxTicks) !== STOCK_MAX_TICKS) codes.push('H7');
  codes.sort((a, b) => HOLD_RULES.indexOf(a) - HOLD_RULES.indexOf(b));
  const f = screened.features;
  const deltas = Array.isArray(evidence?.flapDeltas) ? evidence.flapDeltas.slice(1) : [];
  return {
    ...base,
    codes,
    held: codes.length > 0,
    features: {
      terminalReason: f.terminalReason, minutes: round(f.minutes, 2), score: f.score, survivalSeconds: f.survivalSeconds,
      flaps: f.flaps, flapsPerMinute: round(f.flapsPerMinute, 1), minDelta: deltas.length ? Math.min(...deltas) : null,
      fastPairs: f.fastPairs, topShare: round(f.topShare, 3), longestSameRun: f.longestSameRun, entropyBits: round(f.entropyBits, 2),
      adjSimilar: round(f.adjSimilar, 3), evidenceDelaySeconds: f.evidenceDelaySeconds, unexplainedDescents: f.unexplainedDescents, maxTicks: f.maxTicks,
    },
  };
}

// --- Playing runs on the pure runtime -------------------------------------------

// Plays `decide(snapshot) → flap?` on a stock runtime. With `capTicks`, the inputs stop at the cap and
// the run plays out with no presses (the evidence stays stock and canonical).
export function playDecider(decide, { seed, capTicks = null }) {
  const runtime = createChikunRuntime({ seed, maxTicks: STOCK_MAX_TICKS });
  while (!runtime.terminal) {
    const snapshot = runtime.snapshot();
    const live = capTicks === null || snapshot.tick < capTicks;
    runtime.step({ flap: live ? Boolean(decide(snapshot)) : false });
  }
  return runtime.result();
}

function botDecider(profile, seed) {
  const bot = createChikunBot({ profile, seed, course: liveCourse, physics: GROUND_PHYSICS });
  return (snapshot) => bot.decide(snapshot);
}

const capTicksOf = (capMinutes) => (Number.isFinite(capMinutes) && capMinutes > 0 && capMinutes < 60 ? Math.round(capMinutes * TICKS_PER_MINUTE) : null);

function readJson(path, root = repoRoot) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

// --- Populations -----------------------------------------------------------------

// Set (a): must hold, gated at 100%.
export function mustHoldSet({ pilotSeeds = [1, 2, 3], capMinutes = null, root = repoRoot } = {}) {
  const cap = capTicksOf(capMinutes);
  const out = [];
  for (const seed of pilotSeeds) {
    for (const [name, orientation] of [['routePilotLandscape', 'landscape'], ['routePilotPortrait', 'portrait']]) {
      const result = playDecider(pilotFor(name), { seed, capTicks: cap });
      out.push(screenEvidence(result.evidence, { label: `${name} seed ${seed}`, set: 'a', source: cap ? `live, inputs capped at ${capMinutes} min` : 'live', orientation }));
    }
  }
  const solver = readJson(FIXTURE_PATHS.solver, root).evidence;
  out.push(screenEvidence(solver, { label: 'routePilotFullSnapshot seed 1', set: 'a', source: FIXTURE_PATHS.solver }));
  for (const seed of pilotSeeds.filter((value) => value !== 1).slice(0, cap ? 0 : 2)) {
    const result = playDecider(pilotFor('routePilotFullSnapshot'), { seed });
    out.push(screenEvidence(result.evidence, { label: `routePilotFullSnapshot seed ${seed}`, set: 'a', source: 'live' }));
  }
  // A non-stock client: a bot model's run replayed with maxTicks cut to 3 minutes (run-complete + H7).
  const models = readJson(FIXTURE_PATHS.botModels, root).runs;
  const model = models[0].evidence;
  const deltas = [];
  let tick = 0;
  for (const [index, delta] of model.flapDeltas.entries()) {
    tick = index === 0 ? delta : tick + delta;
    if (tick >= TRUNCATED_MAX_TICKS) break;
    deltas.push(delta);
  }
  out.push(screenEvidence({ ...model, maxTicks: TRUNCATED_MAX_TICKS, flapDeltas: deltas }, { label: `truncated client (${models[0].profile} model, maxTicks ${TRUNCATED_MAX_TICKS})`, set: 'a', source: FIXTURE_PATHS.botModels }));
  // Late evidence: a bot model's run that reached the server 25 minutes after it could have ended.
  const late = models[1];
  const openedAt = Date.parse('2026-09-28T12:00:00.000Z');
  const survivalSeconds = Math.floor(late.result.survivalTicks / 60);
  out.push(screenEvidence(late.evidence, {
    label: `late evidence (${late.profile} model, +${LATE_EVIDENCE_SECONDS} s)`, set: 'a', source: FIXTURE_PATHS.botModels,
    row: { openedAt: new Date(openedAt).toISOString(), verifiedAt: new Date(openedAt + (survivalSeconds + LATE_EVIDENCE_SECONDS) * 1000).toISOString() },
  }));
  return out;
}

// Set (b): known evasion, reported (not gated).
export function knownEvasionSet({ bots = 0, capMinutes = null, evasionSeeds = [1, 2, 3], root = repoRoot } = {}) {
  const cap = capTicksOf(capMinutes);
  const out = [];
  for (let index = 0; index < bots; index += 1) {
    const seed = harnessSeed(index);
    const result = playDecider(botDecider(botProfile('exceptional'), seed), { seed, capTicks: cap });
    out.push(screenEvidence(result.evidence, { label: `exceptional bot seed ${seed}`, set: 'b', source: 'live' }));
  }
  for (const seed of evasionSeeds) {
    const result = playDecider(evasionPilotFor('humanisedSolver', { seed }), { seed, capTicks: cap });
    out.push(screenEvidence(result.evidence, { label: `humanisedSolver seed ${seed}`, set: 'b', source: cap ? `live, inputs capped at ${capMinutes} min` : 'live' }));
  }
  out.push(screenEvidence(readJson(FIXTURE_PATHS.widened, root).evidence, { label: 'widenedViewPilot seed 1', set: 'b', source: FIXTURE_PATHS.widened }));
  for (const seed of evasionSeeds.filter((value) => value !== 1).slice(0, cap ? 1 : 2)) {
    const result = playDecider(evasionPilotFor('widenedViewPilot', { seed }), { seed, capTicks: cap });
    out.push(screenEvidence(result.evidence, { label: `widenedViewPilot seed ${seed}`, set: 'b', source: cap ? `live, inputs capped at ${capMinutes} min` : 'live' }));
  }
  return out;
}

// Set (c) from replay files: chikun-replay-file-v1 ({ format, game, evidence }) or bare v6 evidence.
export function humanDirSet(dir) {
  const out = [];
  const rejected = [];
  if (!dir) return { runs: out, rejected };
  const files = readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
  for (const name of files) {
    const text = readFileSync(join(dir, name), 'utf8');
    let evidence;
    try {
      const parsed = JSON.parse(text);
      const file = parsed?.format === 'chikun-replay-file-v1' ? text : JSON.stringify({ format: 'chikun-replay-file-v1', game: 'chikun', evidence: parsed });
      importChikunReplay(file);
      evidence = parsed?.format === 'chikun-replay-file-v1' ? parsed.evidence : parsed;
    } catch (error) {
      rejected.push({ file: name, reason: String(error?.message ?? error).slice(0, 120) });
      continue;
    }
    out.push(screenEvidence(evidence, { label: `human ${name}`, set: 'c', source: 'human-dir', orientation: /portrait/i.test(name) ? 'portrait' : 'landscape' }));
  }
  return { runs: out, rejected };
}

export function parseVouched(text) {
  const raw = String(text ?? '').trim();
  let list;
  try {
    const parsed = JSON.parse(raw);
    list = Array.isArray(parsed) ? parsed : parsed?.wallets;
  } catch {
    list = raw.split(/\r?\n/);
  }
  if (!Array.isArray(list)) throw new Error('--vouched must list wallet addresses');
  const wallets = new Set();
  for (const entry of list) {
    const value = String(entry ?? '').trim().toLowerCase();
    if (!value || value.startsWith('#')) continue;
    if (!/^0x[0-9a-f]{40}$/.test(value)) throw new Error('--vouched holds an entry that is not an address');
    wallets.add(value);
  }
  return wallets;
}

// Set (c) from Neon, read-only: confirmed Chikun Ranked runs with v6 evidence. Vouched wallets go to the
// human set; every other row to 'neonUnvouched', which never enters a gate denominator. Labels are
// anonymous; no wallet leaves this function.
export async function neonSets(db, { vouched = new Set(), limit = 500 } = {}) {
  const rows = await db.query(
    `SELECT vs.wallet, vs.score::text AS score, vs.survival_seconds::text AS survival_seconds, vs.stats::text AS stats,
            to_char(vs.opened_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS opened_at,
            to_char(vs.verified_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS verified_at, se.evidence
       FROM verified_sessions vs JOIN session_evidence se ON se.session_id32 = vs.session_id32
      WHERE vs.game_id = 'chikun' AND vs.status = 'confirmed' AND se.encoding = 'chikun-flap-evidence-v6+json'
      ORDER BY vs.verified_at DESC, vs.session_id32 ASC LIMIT $1::int`,
    [String(limit)],
  );
  const human = [];
  const unvouched = [];
  for (const row of rows) {
    let evidence = null;
    try {
      evidence = JSON.parse(row.evidence);
    } catch {
      evidence = null;
    }
    let stats = {};
    try {
      stats = JSON.parse(row.stats ?? '{}') ?? {};
    } catch {
      stats = {};
    }
    const isVouched = vouched.has(String(row.wallet).toLowerCase());
    const target = isVouched ? human : unvouched;
    target.push(screenEvidence(evidence, {
      label: `${isVouched ? 'neon vouched' : 'neon unvouched'} ${target.length + 1}`, set: isVouched ? 'c' : 'neon-unvouched', source: 'neon',
      row: { score: Number(row.score), survivalSeconds: Number(row.survival_seconds), stats, openedAt: row.opened_at, verifiedAt: row.verified_at },
      orientation: stats.orientation === 'portrait' ? 'portrait' : 'landscape',
    }));
  }
  return { human, unvouched };
}

// The B.4 probe table: bot human models, reflex bots, pilots, the solver and the evasion pilots.
export function probePopulations({ bots = 0, capMinutes = null, setA = [], setB = [], root = repoRoot } = {}) {
  const cap = capTicksOf(capMinutes);
  const models = readJson(FIXTURE_PATHS.botModels, root).runs.map((run) => screenEvidence(run.evidence, { label: `${run.profile} model (fixture)`, set: 'probe', source: FIXTURE_PATHS.botModels }));
  for (const profile of CHIKUN_BOT_PROFILES) {
    for (let index = 0; index < bots; index += 1) {
      const seed = harnessSeed(index);
      const result = playDecider(botDecider(profile, seed), { seed, capTicks: cap });
      models.push(screenEvidence(result.evidence, { label: `${profile.name} model seed ${seed}`, set: 'probe', source: 'live', orientation: profile.viewport.orientation }));
    }
  }
  const reflex = [];
  for (const reaction of REFLEX_REACTIONS) {
    for (let index = 0; index < bots; index += 1) {
      const seed = harnessSeed(index);
      const profile = { name: `reflex-${reaction}`, reactionDelayTicks: reaction, jitterSigmaTicks: 0.5, lookAheadPx: 1000, viewport: { orientation: 'landscape', width: 1280, height: 720 } };
      const result = playDecider(botDecider(profile, seed), { seed, capTicks: cap });
      reflex.push(screenEvidence(result.evidence, { label: `reflex ${reaction}-tick seed ${seed}`, set: 'probe', source: 'live' }));
    }
  }
  return [
    { name: 'Bot "human models" (novice → exceptional)', runs: models },
    { name: 'Reflex bots (reaction 1-3 ticks, jitter 0.5, in-viewport)', runs: reflex },
    { name: 'Scripted pilots, visible view (routePilot landscape and portrait)', runs: setA.filter((run) => /^routePilot(Landscape|Portrait)/.test(run.label)) },
    { name: 'Solver (routePilotFullSnapshot)', runs: setA.filter((run) => run.label.startsWith('routePilotFullSnapshot')) },
    { name: 'Humanised solver (jitter, >= 6-tick gap)', runs: setB.filter((run) => run.label.startsWith('humanisedSolver')) },
    { name: 'Widened-view pilot (2.5x stock view, humanised)', runs: setB.filter((run) => run.label.startsWith('widenedViewPilot')) },
  ].map(summarizePopulation);
}

function rangeOf(values) {
  const list = values.filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value))).map(Number);
  return list.length ? [Math.min(...list), Math.max(...list)] : null;
}

export function summarizePopulation({ name, runs }) {
  const features = runs.map((run) => run.features).filter(Boolean);
  const pick = (key) => rangeOf(features.map((f) => f[key]));
  return {
    name,
    n: runs.length,
    minutes: pick('minutes'), flapsPerMinute: pick('flapsPerMinute'), minDelta: pick('minDelta'), fastPairs: pick('fastPairs'),
    topShare: pick('topShare'), longestSameRun: pick('longestSameRun'), entropyBits: pick('entropyBits'), unexplainedDescents: pick('unexplainedDescents'),
    held: runs.filter((run) => run.held).length,
    holdsByRule: holdsByRule(runs),
  };
}

export function holdsByRule(runs) {
  const out = {};
  for (const rule of HOLD_RULES) {
    const holds = runs.filter((run) => run.codes.includes(rule)).length;
    out[rule] = { holds, rate: runs.length ? round(holds / runs.length, 4) : null, upper95: clopperPearsonUpper(holds, runs.length) };
  }
  return out;
}

// Fixed-seed, varied-noise pass: the same course seeds, the same profile, different motor-noise streams
// (the profile name keys the bot's noise and cruise draw, never the course). The seed's share of the
// survival variance says how much seed shopping could buy (design B.5 item 4).
export function seedVariancePass({ profileName = 'expert', seeds = 4, noise = 4, capMinutes = null } = {}) {
  const cap = capTicksOf(capMinutes);
  const base = botProfile(profileName);
  const bySeed = [];
  for (let index = 0; index < seeds; index += 1) {
    const seed = harnessSeed(index);
    const minutes = [];
    for (let variant = 0; variant < noise; variant += 1) {
      const profile = variant === 0 ? base : { ...base, name: `${base.name}~noise${variant}` };
      const result = playDecider(botDecider(profile, seed), { seed, capTicks: cap });
      minutes.push(round(result.survivalTicks / TICKS_PER_MINUTE, 2));
    }
    bySeed.push({ seed, minutes, mean: round(minutes.reduce((a, b) => a + b, 0) / minutes.length, 2) });
  }
  const all = bySeed.flatMap((entry) => entry.minutes);
  const grand = all.reduce((a, b) => a + b, 0) / all.length;
  const total = all.reduce((sum, value) => sum + (value - grand) ** 2, 0) / all.length;
  const between = bySeed.reduce((sum, entry) => sum + entry.minutes.length * (entry.mean - grand) ** 2, 0) / all.length;
  return {
    profile: profileName, seeds, noiseVariants: noise, capMinutes: cap ? capMinutes : null, bySeed,
    grandMeanMinutes: round(grand, 2), totalVariance: round(total, 3), betweenSeedVariance: round(between, 3),
    seedShare: total > 0 ? round(between / total, 3) : null,
    spreadOfSeedMeans: rangeOf(bySeed.map((entry) => entry.mean)),
    note: 'seedShare near 0: the course seed explains little of the survival spread (seed shopping is a small edge); near 1: the seed dominates.',
  };
}

// --- The receipt -------------------------------------------------------------------

export async function runCalibration({
  probe = false, bots = 0, seedVariance = false, humanDir = null, fromNeon = false, vouched = null, db = null, env = process.env, fetchImpl = globalThis.fetch,
  capMinutes = null, pilotSeeds = [1, 2, 3], neonLimit = 500, root = repoRoot, nowMs = Date.now(), command = null, log = () => {},
} = {}) {
  const started = Date.now();
  log('set (a): must-hold');
  const setA = mustHoldSet({ pilotSeeds, capMinutes, root });
  log('set (b): known evasion');
  const setB = knownEvasionSet({ bots, capMinutes, evasionSeeds: pilotSeeds, root });
  log('set (c): human');
  const fromDir = humanDir ? humanDirSet(humanDir) : { runs: [], rejected: [] };
  let neon = { human: [], unvouched: [] };
  if (fromNeon) {
    let client = db;
    if (!client) {
      const url = typeof env.NEON_DATABASE_URL === 'string' ? env.NEON_DATABASE_URL.trim() : '';
      if (!url) throw new Error('--from-neon needs NEON_DATABASE_URL in the environment');
      client = createNeonClient({ connectionString: url, fetchImpl });
    }
    neon = await neonSets(client, { vouched: vouched ?? new Set(), limit: neonLimit });
  }
  const human = [...fromDir.runs, ...neon.human];
  const longRuns = human.filter((run) => Number(run.features?.minutes) >= HUMAN_GATE.longRunMinutes).length;
  const humanByRule = holdsByRule(human);
  const h4h6Holds = HUMAN_GATE.zeroHoldRules.reduce((sum, rule) => sum + humanByRule[rule].holds, 0);
  const setAHeld = setA.filter((run) => run.held).length;
  const setBMissed = setB.filter((run) => !run.held).length;

  const receipt = {
    version: CALIBRATION_VERSION,
    plausibilityVersion: PLAUSIBILITY_VERSION,
    evasionPilotVersion: EVASION_PILOT_VERSION,
    generatedAt: new Date(nowMs).toISOString(),
    command,
    capMinutes: capTicksOf(capMinutes) ? capMinutes : null,
    thresholds: THRESHOLDS,
    sets: {
      a: { name: 'must-hold', gated: true, n: setA.length, held: setAHeld, heldRate: setA.length ? round(setAHeld / setA.length, 4) : null, pass: setA.length > 0 && setAHeld === setA.length, runs: setA },
      b: {
        name: 'known-evasion', gated: false, n: setB.length, missed: setBMissed, missRate: setB.length ? round(setBMissed / setB.length, 4) : null,
        byPilot: Object.fromEntries(['exceptional bot', 'humanisedSolver', 'widenedViewPilot'].map((prefix) => {
          const runs = setB.filter((run) => run.label.startsWith(prefix));
          const missed = runs.filter((run) => !run.held).length;
          return [prefix, { n: runs.length, missed, missRate: runs.length ? round(missed / runs.length, 4) : null }];
        })),
        note: 'Reported, not gated: these are what the screen cannot catch. Human review, caps and, for real value, personhood or winner verification are the defence (design B.5).',
        runs: setB,
      },
      c: {
        name: 'human', gated: true, n: human.length, fromDir: fromDir.runs.length, fromNeonVouched: neon.human.length, rejectedFiles: fromDir.rejected,
        longRuns, people: null, peopleNote: `At least ${HUMAN_GATE.minPeople} people known to the owner, with a screen recording of each session kept by the owner (not committed); the owner attests the count.`,
        holdsByRule: humanByRule, h4h6Holds, runs: human,
      },
      neonUnvouched: { name: 'neon rows not vouched for', gated: false, n: neon.unvouched.length, holdsByRule: holdsByRule(neon.unvouched), note: 'Never in a gate denominator: a live cheater would poison the human set.' },
    },
    probe: probe ? probePopulations({ bots, capMinutes, setA, setB, root }) : null,
    seedVariance: seedVariance ? seedVariancePass({ seeds: Math.max(2, Math.min(bots || 4, 8)), noise: 4, capMinutes }) : null,
    gate: null,
    elapsedSeconds: null,
  };
  const humanReady = human.length >= HUMAN_GATE.minRuns && longRuns >= HUMAN_GATE.minLongRuns;
  receipt.gate = {
    setAAllHeld: receipt.sets.a.pass,
    setBMissRatesRecorded: true,
    humanRuns: human.length,
    humanRunsNeeded: HUMAN_GATE.minRuns,
    humanLongRuns: longRuns,
    humanLongRunsNeeded: HUMAN_GATE.minLongRuns,
    humanH4H6Holds: h4h6Holds,
    humanH4H6Zero: human.length > 0 ? h4h6Holds === 0 : null,
    ready: receipt.sets.a.pass && humanReady && h4h6Holds === 0,
    notes: [
      ...(receipt.sets.a.pass ? [] : ['Set (a) is not 100% held: tune the thresholds in server/jackpot/plausibility.mjs before JACKPOT_LIVE.']),
      ...(humanReady ? [] : [`The human set is incomplete (${human.length} of ${HUMAN_GATE.minRuns} runs, ${longRuns} of ${HUMAN_GATE.minLongRuns} of ${HUMAN_GATE.longRunMinutes}+ minutes): OJ2 stays open.`]),
      ...(h4h6Holds > 0 ? [`${h4h6Holds} human hold(s) on H4-H6: the gate fails until the rule is retuned.`] : []),
      'H2/H3/H9 human hold rates are recorded above; a human record in the first weeks is meant to be reviewed rather than auto-paid.',
    ],
  };
  receipt.elapsedSeconds = round((Date.now() - started) / 1000, 1);
  return receipt;
}

// --- The committed replay fixtures (tests/fixtures/jackpot-server) ----------------

export function recordJackpotFixtures() {
  const solver = playDecider(pilotFor('routePilotFullSnapshot'), { seed: 1 });
  const widened = playDecider(evasionPilotFor('widenedViewPilot', { seed: 1 }), { seed: 1 });
  return {
    [FIXTURE_PATHS.solver]: { note: 'routePilotFullSnapshot, seed 1, stock maxTicks: a 60-minute run-complete (the one H1 replay the tests allow). Regenerate with node scripts/chikun-plausibility-calibrate.mjs --fixtures.', evidence: solver.evidence },
    [FIXTURE_PATHS.widened]: { note: 'widenedViewPilot (scripts/lib/chikun-evasion-pilots.mjs), seed 1, stock maxTicks. Regenerate with node scripts/chikun-plausibility-calibrate.mjs --fixtures.', evidence: widened.evidence },
  };
}

// --- CLI ---------------------------------------------------------------------------

export function parseCalibrateArgs(argv = []) {
  const options = { probe: false, bots: 0, seedVariance: false, humanDir: null, fromNeon: false, vouched: null, capMinutes: null, pilotSeeds: 3, out: null, write: true, fixtures: false, neonLimit: 500 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i]);
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined || String(value).startsWith('--')) throw new Error(`${arg} needs a value`);
      i += 1;
      return String(value);
    };
    if (arg === '--probe') options.probe = true;
    else if (arg === '--seed-variance') options.seedVariance = true;
    else if (arg === '--from-neon') options.fromNeon = true;
    else if (arg === '--no-write') options.write = false;
    else if (arg === '--fixtures') options.fixtures = true;
    else if (arg === '--bots') options.bots = Number(next());
    else if (arg === '--human-dir') options.humanDir = next();
    else if (arg === '--vouched') options.vouched = next();
    else if (arg === '--cap-minutes') options.capMinutes = Number(next());
    else if (arg === '--pilot-seeds') options.pilotSeeds = Number(next());
    else if (arg === '--neon-limit') options.neonLimit = Number(next());
    else if (arg === '--out') options.out = next();
    else throw new Error(`unknown argument ${arg}`);
  }
  if (!Number.isInteger(options.bots) || options.bots < 0 || options.bots > 200) throw new Error('--bots must be an integer 0-200');
  if (!Number.isInteger(options.pilotSeeds) || options.pilotSeeds < 1 || options.pilotSeeds > 12) throw new Error('--pilot-seeds must be an integer 1-12');
  if (options.capMinutes !== null && !(options.capMinutes > 0 && options.capMinutes <= 60)) throw new Error('--cap-minutes must be in (0, 60]');
  if (options.vouched && !options.fromNeon) throw new Error('--vouched only applies with --from-neon');
  return options;
}

export function defaultReceiptPath(nowMs = Date.now()) {
  return `docs/qa/chikun-plausibility-calibration-${new Date(nowMs).toISOString().slice(0, 10).replace(/-/g, '')}.json`;
}

async function main() {
  const options = parseCalibrateArgs(process.argv.slice(2));
  if (options.fixtures) {
    for (const [path, doc] of Object.entries(recordJackpotFixtures())) {
      writeFileSync(resolve(repoRoot, path), `${JSON.stringify(doc)}\n`);
      console.log(`wrote ${path} (${doc.evidence.flapDeltas.length} flaps, ${flapTicksOf(doc.evidence).at(-1) ?? 0} last flap tick)`);
    }
    return;
  }
  const vouched = options.vouched ? parseVouched(readFileSync(options.vouched, 'utf8')) : null;
  const receipt = await runCalibration({
    probe: options.probe, bots: options.bots, seedVariance: options.seedVariance, humanDir: options.humanDir, fromNeon: options.fromNeon, vouched,
    capMinutes: options.capMinutes, pilotSeeds: Array.from({ length: options.pilotSeeds }, (_, index) => index + 1), neonLimit: options.neonLimit,
    command: `node scripts/chikun-plausibility-calibrate.mjs ${process.argv.slice(2).join(' ')}`.trim(), log: (line) => console.log(line),
  });
  const { a, b, c } = receipt.sets;
  console.log(`set (a) must-hold: ${a.held}/${a.n} held (${a.pass ? 'PASS' : 'FAIL'})`);
  console.log(`set (b) known-evasion: ${b.missed}/${b.n} missed (reported, not gated)`);
  console.log(`set (c) human: ${c.n} runs, ${c.longRuns} of 8+ min, H4-H6 holds ${c.h4h6Holds}; unvouched Neon rows ${receipt.sets.neonUnvouched.n} (never gated)`);
  console.log(`gate ready: ${receipt.gate.ready}`);
  if (options.write) {
    const out = options.out ? resolve(options.out) : resolve(repoRoot, defaultReceiptPath());
    if (existsSync(out)) console.log(`replacing ${out}`);
    writeFileSync(out, `${JSON.stringify(receipt, null, 2)}\n`);
    console.log(`wrote ${out}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`chikun-plausibility-calibrate: ${error?.message ?? error}`);
    process.exitCode = 1;
  });
}
