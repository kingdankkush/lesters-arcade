// The human-plausibility screen of the Chikun Weekly Jackpot (design §B.4).
// Server only: never import this module from apps/** (the thresholds are not
// a public module; the rules page describes categories, not numbers).
//
// Pure and deterministic. It only HOLDS a run for the admin's review; it never
// disqualifies (J11). It catches unsophisticated automation only: scripts with
// regular timing, runs far beyond the human envelope, late evidence and
// tampered clients. A careful in-view bot passes it (§B.5).
//
//   analyzeChikunEvidence(evidence, opts)   one replay on the pure runtime that
//     records what the features, S8 and the review timeline need
//   computeFeatures({ evidence, analysis, row })
//   holdCodes(features, context)            H1-H6, H8-H11 (H7 is the screen's
//                                           integrity result)
//   pureSoftSignals(features)               S4, S5, S6, S8, S9 (the others read
//                                           Neon or the chain: screen.mjs)
//   reviewTimeline(analysis)                the owner page's flap timeline
//
// Thresholds are v1 and provisional until the calibration gate (OJ2):
// scripts/chikun-plausibility-calibrate.mjs re-runs every rule over the
// named populations and writes the receipt.

import { createChikunRuntime, flapTicksOf } from '../../apps/portal/src/chikun-cabinet.mjs';
import { GROUND_PHYSICS } from '../../apps/portal/src/chikun-ground-runtime.mjs';
import { buildChikunViewport } from '../../apps/chikun/src/viewport.mjs';

export const PLAUSIBILITY_VERSION = 'chikun-plausibility-v1';
export const STOCK_MAX_TICKS = 216_000;
export const TICKS_PER_MINUTE = 3600;
export const THRESHOLDS = Object.freeze({
  H1: Object.freeze(['run-complete', 'flap-limit']),
  H2: 1080, // survivalSeconds > 18 min
  H3: 80_000, // score
  H4: Object.freeze({ gapTicks: 2, min: 5, share: 0.01 }),
  H5: Object.freeze({ topShare: 0.45, longestSameRun: 25, entropyBits: 3.0 }),
  H6: Object.freeze({ flapsPerMinute: 85, minMinutes: 3 }),
  H9: 1200, // evidenceDelaySeconds > 20 min
  H11: 2, // unexplainedDescents
  S1: 7 * 24 * 3600, // the wallet's first Ranked run is younger than 7 days
  S2: Object.freeze({ ratio: 1.5, minRuns: 5 }),
  S3: 40, // settled Chikun Ranked runs this week
  S4: Object.freeze([35, 75]), // flapsPerMinute outside
  S5: 0.35, // adjSimilar
  S6: 1.5, // nearMissPerMinute
  S9: Object.freeze([300, 1200]), // evidenceDelaySeconds between 5 and 20 minutes
  S10: Object.freeze({ maxCalls: 20, weeks: 8, hops: 2 }),
  S8: Object.freeze({ airborneAboveY: 400, leadTicks: 60 }),
});

// Plain-English rule text, served to the admin by the review API.
export const HOLD_RULE_TEXT = Object.freeze({
  H1: 'The run ended at the 60-minute limit or the flap limit, which no model or stock human play reaches.',
  H2: 'Survival over 18 minutes (1.15 × the harness p99).',
  H3: 'Score over 80,000 (1.18 × the harness score p99).',
  H4: 'At least 5 fast pairs (flaps ≤ 2 ticks apart) and at least 1% of intervals. Humans can make these with two keys or a worn mouse: never disqualify on H4 alone.',
  H5: 'Machine-regular timing: one interval ≥ 45% of all, a run of ≥ 25 equal intervals, or interval entropy under 3 bits.',
  H6: 'At least 85 flaps per minute over at least 3 minutes (scripts fly at 90-95).',
  H7: 'Integrity: missing evidence, a replay or chain mismatch, a chain-index row, a non-stock client (maxTicks ≠ 216,000) or a bad seed ticket.',
  H8: 'The wallet is excluded from the board.',
  H9: 'Late evidence: the run reached the server more than 20 minutes after it could have ended (a banked or long-paused session).',
  H10: 'No seed ticket was logged for this session, so its issue time and provenance cannot be checked.',
  H11: 'Two or more descents under ground obstacles committed before the obstacle was on screen (look-ahead).',
});

export const SOFT_SIGNAL_TEXT = Object.freeze({
  S1: "The wallet's first Ranked run is less than 7 days old.",
  S2: "The score is more than 1.5 × the wallet's previous best (with at least 5 earlier runs).",
  S3: 'More than 40 settled Chikun Ranked runs this week.',
  S4: 'Flaps per minute outside 35-75.',
  S5: 'More than 35% of consecutive intervals within ±1 tick of each other.',
  S6: 'More than 1.5 near misses per minute.',
  S7: 'The wallet was flagged or disqualified before.',
  S8: 'Unexplained descents: route commitments before a ground obstacle was visible.',
  S9: 'The evidence arrived 5-20 minutes after the run could have ended.',
  S10: 'Another candidate or flagged wallet of the last 8 weeks got its first zkLTC from the same address (2 hops).',
  S11: 'Seed tickets issued to the wallet this week per settled Ranked run (seed shopping).',
});

const LOCOMOTION_CODES = Object.freeze({ run: 0, jump: 1, flight: 2, fall: 3 });

// The stock view edge in logical x: 1,280 in landscape; the phone screen's
// right edge in portrait (design §B.4, S8).
export function stockViewEdge(orientation = 'landscape') {
  if (orientation !== 'portrait') return 1280;
  const view = buildChikunViewport(390, 844, 1);
  return view.left + view.width;
}

function gravityFor(locomotion) {
  if (locomotion === 'run') return 0;
  return locomotion === 'flight' ? GROUND_PHYSICS.flightGravity : GROUND_PHYSICS.jumpGravity;
}

// One replay on the pure runtime (the same one the verifier uses), recording
// per tick Chikun's altitude and locomotion, and per obstacle the tick it
// entered the stock view and the tick it was passed. → the analysis object.
export function analyzeChikunEvidence(evidence, { orientation = 'landscape' } = {}) {
  const ticks = flapTicksOf(evidence);
  const flapSet = new Set(ticks);
  const maxTicks = Math.floor(Number(evidence.maxTicks));
  const runtime = createChikunRuntime({ seed: evidence.seed, maxTicks, evidenceVersion: evidence.version });
  const edge = stockViewEdge(orientation);
  const altitude = new Float32Array(maxTicks + 2);
  const locomotion = new Uint8Array(maxTicks + 2);
  const obstacles = new Map();
  const fastPairs = [];
  let previousFlap = null;
  while (!runtime.terminal) {
    const snapshot = runtime.snapshot();
    const tick = snapshot.tick;
    const chikun = snapshot.chikun;
    altitude[tick] = chikun.y;
    locomotion[tick] = LOCOMOTION_CODES[chikun.locomotion] ?? 0;
    for (const fork of snapshot.forks) {
      let entry = obstacles.get(fork.index);
      if (!entry) {
        entry = { index: fork.index, kind: fork.kind, route: fork.route, visibleTick: null, passTick: null };
        obstacles.set(fork.index, entry);
      }
      if (entry.visibleTick === null && fork.x < edge) entry.visibleTick = tick;
    }
    const flap = flapSet.has(tick);
    if (flap && previousFlap !== null && tick - previousFlap <= THRESHOLDS.H4.gapTicks) {
      // Did the second flap of a fast pair change the trajectory? A flap sets
      // the velocity (it does not add), so a second flight flap 1-2 ticks
      // later only re-sets the same upward speed: a velocity change of at most
      // 2 × flight gravity (0.24 px/tick). It changes the trajectory only when
      // it changes the locomotion (a jump becoming flight) or the velocity by
      // more than 0.5 px/tick.
      const before = chikun.locomotion;
      const afterFlap = before === 'run' ? 'jump' : 'flight';
      const withFlap = Math.min(GROUND_PHYSICS.maxFallVelocity, (before === 'run' ? GROUND_PHYSICS.jumpVelocity : GROUND_PHYSICS.flightVelocity) + gravityFor(afterFlap));
      const without = before === 'run' ? 0 : Math.min(GROUND_PHYSICS.maxFallVelocity, chikun.velocityY + gravityFor(before));
      const deltaV = Math.abs(withFlap - without);
      fastPairs.push({ tick, gap: tick - previousFlap, deltaV: Math.round(deltaV * 1000) / 1000, changedTrajectory: afterFlap !== before || deltaV > 0.5 });
    }
    if (flap) previousFlap = tick;
    const next = runtime.step({ flap });
    for (const fork of next.forks) {
      const entry = obstacles.get(fork.index);
      if (entry && fork.passed && entry.passTick === null) entry.passTick = next.tick;
    }
  }
  const result = runtime.result();
  const survivalTicks = result.survivalTicks;
  altitude[survivalTicks] = result.finalState.y;
  return Object.freeze({
    version: PLAUSIBILITY_VERSION,
    orientation,
    viewEdge: edge,
    ticks,
    result,
    survivalTicks,
    terminalReason: result.finalState.terminalReason,
    altitude,
    locomotion,
    obstacles: [...obstacles.values()].sort((a, b) => a.index - b.index),
    fastPairs,
  });
}

// The last flap strictly before `tick` (binary search over ascending ticks).
function lastFlapBefore(ticks, tick) {
  let lo = 0;
  let hi = ticks.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ticks[mid] < tick) lo = mid + 1;
    else hi = mid;
  }
  return lo === 0 ? null : ticks[lo - 1];
}

// S8 (design §B.4): ground-route obstacles passed where Chikun was airborne
// above y 400 at visibleTick − 60, the last flap before the passage came
// before the obstacle was visible, and no other obstacle was visible in
// between. Every model scores 0 by construction (a model reacts only to what
// is on screen). → { count, obstacles: [index...] }
export function unexplainedDescents(analysis) {
  const { ticks, obstacles, altitude, locomotion } = analysis;
  const { airborneAboveY, leadTicks } = THRESHOLDS.S8;
  const passed = obstacles.filter((entry) => entry.passTick !== null && entry.visibleTick !== null);
  const found = [];
  for (const entry of passed) {
    if (entry.route !== 'ground') continue;
    const probe = entry.visibleTick - leadTicks;
    if (probe < 0) continue;
    if (!(altitude[probe] < airborneAboveY) || locomotion[probe] === LOCOMOTION_CODES.run) continue;
    const commit = lastFlapBefore(ticks, entry.passTick);
    if (commit === null || commit >= entry.visibleTick) continue;
    // Another obstacle visible (and not yet passed) between the commitment and
    // the moment this one appeared explains the descent.
    const explained = passed.some((other) => other !== entry && other.visibleTick < entry.visibleTick && other.passTick > commit);
    if (!explained) found.push(entry.index);
  }
  return { count: found.length, obstacles: found };
}

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

// Interval statistics of d = flapDeltas.slice(1).
export function intervalStats(flapDeltas) {
  const d = Array.isArray(flapDeltas) ? flapDeltas.slice(1) : [];
  const counts = new Map();
  let longest = d.length ? 1 : 0;
  let current = d.length ? 1 : 0;
  let similar = 0;
  let fastPairs = 0;
  for (let i = 0; i < d.length; i += 1) {
    counts.set(d[i], (counts.get(d[i]) ?? 0) + 1);
    if (d[i] <= THRESHOLDS.H4.gapTicks) fastPairs += 1;
    if (i > 0) {
      if (d[i] === d[i - 1]) {
        current += 1;
        longest = Math.max(longest, current);
      } else {
        current = 1;
      }
      if (Math.abs(d[i] - d[i - 1]) <= 1) similar += 1;
    }
  }
  let top = 0;
  let entropy = 0;
  for (const count of counts.values()) {
    top = Math.max(top, count);
    const p = count / d.length;
    entropy -= p * Math.log2(p);
  }
  return {
    intervals: d.length,
    fastPairs,
    topShare: d.length ? round(top / d.length) : 0,
    longestSameRun: longest,
    entropyBits: d.length ? round(entropy) : 0,
    adjSimilar: d.length > 1 ? round(similar / (d.length - 1)) : 0,
  };
}

// Features of design §B.4 from the evidence, its replay and the Neon row
// ({ score, survivalSeconds, stats, openedAt, verifiedAt } of verified_sessions).
export function computeFeatures({ evidence, analysis, row = {} }) {
  const stats = row.stats && typeof row.stats === 'object' ? row.stats : {};
  const survivalTicks = analysis?.survivalTicks ?? Math.round(Number(row.survivalSeconds ?? 0) * 60);
  const minutes = survivalTicks / TICKS_PER_MINUTE;
  const flaps = Array.isArray(evidence?.flapDeltas) ? evidence.flapDeltas.length : 0;
  const interval = intervalStats(evidence?.flapDeltas);
  const openedMs = Date.parse(row.openedAt ?? '');
  const verifiedMs = Date.parse(row.verifiedAt ?? '');
  const survivalSeconds = Number(row.survivalSeconds ?? Math.floor(survivalTicks / 60));
  const evidenceDelaySeconds = Number.isFinite(openedMs) && Number.isFinite(verifiedMs)
    ? Math.round((verifiedMs - (openedMs + survivalSeconds * 1000)) / 1000)
    : null;
  const nearMisses = Number(stats.nearMisses ?? analysis?.result?.nearMisses ?? 0);
  const descents = analysis ? unexplainedDescents(analysis) : { count: null, obstacles: [] };
  return {
    version: PLAUSIBILITY_VERSION,
    terminalReason: analysis?.terminalReason ?? stats.terminalReason ?? null,
    survivalSeconds,
    survivalTicks,
    minutes: round(minutes, 3),
    score: Number(row.score ?? analysis?.result?.score ?? 0),
    flaps,
    fastPairs: interval.fastPairs,
    intervals: interval.intervals,
    maxTicks: Number(evidence?.maxTicks ?? 0),
    evidenceDelaySeconds,
    topShare: interval.topShare,
    longestSameRun: interval.longestSameRun,
    entropyBits: interval.entropyBits,
    flapsPerMinute: minutes > 0 ? round(flaps / minutes, 2) : 0,
    adjSimilar: interval.adjSimilar,
    nearMissPerMinute: minutes > 0 ? round(nearMisses / minutes, 3) : 0,
    unexplainedDescents: descents.count,
    unexplainedObstacles: descents.obstacles,
  };
}

// H11 (S8 as a hold rule) applies only under adminClearOnly or a non-testnet
// token, and only AFTER calibration (design §B.4 H11, OJ2, OJ6). The first
// receipt (docs/qa/chikun-plausibility-calibration-20260925.json) shows S8
// does not separate yet: the bot human models and the reflex bots reach 9-11
// unexplained descents, as many as the widened-view pilot. Until a calibrated
// S8 lands and flips this constant in a reviewed commit, H11 stays off and S8
// is a soft signal on the review page only.
export const H11_CALIBRATED = false;
export function h11ActiveFor({ adminClearOnly = false, testnetToken = true, calibrated = H11_CALIBRATED } = {}) {
  return calibrated === true && (adminClearOnly === true || testnetToken !== true);
}

// Hold codes (H1-H6, H8-H11) for a features object.
//   boardExcluded   H8
//   ticketMissing   H10 (no seed_ticket_log row)
//   h11Active       only under adminClearOnly or a non-testnet token, after
//                   calibration (design §B.4, OJ6)
export function holdCodes(features, { boardExcluded = false, ticketMissing = false, h11Active = false } = {}) {
  const codes = [];
  const f = features;
  if (THRESHOLDS.H1.includes(f.terminalReason)) codes.push('H1');
  if (f.survivalSeconds > THRESHOLDS.H2) codes.push('H2');
  if (f.score > THRESHOLDS.H3) codes.push('H3');
  if (f.fastPairs >= THRESHOLDS.H4.min && f.intervals > 0 && f.fastPairs >= THRESHOLDS.H4.share * f.intervals) codes.push('H4');
  if (f.topShare >= THRESHOLDS.H5.topShare || f.longestSameRun >= THRESHOLDS.H5.longestSameRun || f.entropyBits < THRESHOLDS.H5.entropyBits) codes.push('H5');
  if (f.flapsPerMinute >= THRESHOLDS.H6.flapsPerMinute && f.minutes >= THRESHOLDS.H6.minMinutes) codes.push('H6');
  if (boardExcluded) codes.push('H8');
  if (f.evidenceDelaySeconds !== null && f.evidenceDelaySeconds > THRESHOLDS.H9) codes.push('H9');
  if (ticketMissing) codes.push('H10');
  if (h11Active && Number(f.unexplainedDescents) >= THRESHOLDS.H11) codes.push('H11');
  return codes;
}

// The soft signals computable from the features alone.
export function pureSoftSignals(f) {
  return {
    S4: { value: f.flapsPerMinute, on: f.flapsPerMinute < THRESHOLDS.S4[0] || f.flapsPerMinute > THRESHOLDS.S4[1] },
    S5: { value: f.adjSimilar, on: f.adjSimilar > THRESHOLDS.S5 },
    S6: { value: f.nearMissPerMinute, on: f.nearMissPerMinute > THRESHOLDS.S6 },
    S8: { value: f.unexplainedDescents, on: Number(f.unexplainedDescents) > 0 },
    S9: { value: f.evidenceDelaySeconds, on: f.evidenceDelaySeconds !== null && f.evidenceDelaySeconds >= THRESHOLDS.S9[0] && f.evidenceDelaySeconds <= THRESHOLDS.S9[1] },
  };
}

// The flag reason for a hold (the coarse public code): integrity first, then
// an excluded wallet, then late evidence, else a screen hold.
export function flagReasonFor({ result, codes }) {
  if (result === 'integrity-fail') return 'integrity';
  if (codes.includes('H8')) return 'excluded-wallet';
  if (codes.includes('H9')) return 'late-evidence';
  return 'screen-hold';
}

// The owner page's timeline (design §C.4 screen step 7, §C.6, §D.5):
// intervals, altitude every 6 ticks, each passed obstacle's visible tick and
// route-commit tick, and the fast pairs with whether each changed the
// trajectory. Plain JSON, drawable without the Chikun runtime.
export function reviewTimeline(analysis, { sampleEveryTicks = 6 } = {}) {
  const altitude = [];
  for (let tick = 0; tick <= analysis.survivalTicks; tick += sampleEveryTicks) altitude.push(Math.round(analysis.altitude[tick]));
  const unexplained = new Set(unexplainedDescents(analysis).obstacles);
  return {
    version: 1,
    sampleEveryTicks,
    survivalTicks: analysis.survivalTicks,
    viewEdge: analysis.viewEdge,
    orientation: analysis.orientation,
    firstFlapTick: analysis.ticks.length ? analysis.ticks[0] : null,
    intervals: analysis.ticks.slice(1).map((tick, index) => tick - analysis.ticks[index]),
    altitude,
    obstacles: analysis.obstacles.filter((entry) => entry.passTick !== null).map((entry) => ({
      index: entry.index,
      kind: entry.kind,
      route: entry.route,
      visibleTick: entry.visibleTick,
      passTick: entry.passTick,
      commitTick: lastFlapBefore(analysis.ticks, entry.passTick),
      unexplained: unexplained.has(entry.index),
    })),
    fastPairs: analysis.fastPairs.map(({ tick, gap, changedTrajectory }) => ({ tick, gap, changedTrajectory })),
  };
}

// The whole pure screen of one run: features, hold codes and pure soft
// signals. (screen.mjs adds integrity, provenance and the Neon/RPC signals.)
export function screenRun({ evidence, row = {}, orientation = 'landscape', boardExcluded = false, ticketMissing = false, h11Active = false, analysis = null }) {
  const replay = analysis ?? analyzeChikunEvidence(evidence, { orientation });
  const features = computeFeatures({ evidence, analysis: replay, row: { score: replay.result.score, survivalSeconds: Math.floor(replay.survivalTicks / 60), ...row } });
  const codes = holdCodes(features, { boardExcluded, ticketMissing, h11Active });
  return { analysis: replay, features, codes, soft: pureSoftSignals(features) };
}
