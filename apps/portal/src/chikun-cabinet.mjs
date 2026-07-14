import { ARCADE_SDK_VERSION } from './arcade-sdk.mjs';
import { createInProcessGameAdapter } from './game-adapter.mjs';

export const CHIKUN_CABINET_VERSION = '0.2.0';
export const CHIKUN_RUNTIME_VERSION = 'deterministic-core-v2';
export const CHIKUN_FIXED_STEP_HZ = 60;
export const CHIKUN_MAX_FLAP_TRANSITIONS = 4_096;
const CHIKUN_MAX_RUN_TICKS = CHIKUN_FIXED_STEP_HZ * 60 * 60;
const CHIKUN_EVIDENCE_VERSION = 'chikun-flap-evidence-v1';

export const CHIKUN_VERTICAL_SLICE_CONFIG = Object.freeze({
  gameId: 'chikun',
  title: "Chikun's Escape",
  version: CHIKUN_CABINET_VERSION,
  runtimeVersion: CHIKUN_RUNTIME_VERSION,
  sdkVersion: ARCADE_SDK_VERSION,
  rules: Object.freeze({
    input: 'tap-to-flap',
    fixedStepHz: CHIKUN_FIXED_STEP_HZ,
    gravityPerTick: 0.34,
    flapImpulse: -2.85,
    ceilingY: 0,
    floorY: 100,
    score: Object.freeze({ coinValue: 25, forkPassValue: 10, survivalTickValue: 1 }),
  }),
  hazards: Object.freeze([
    Object.freeze({ id: 'fork-gap', label: 'Fork Gap', width: 12, safeGapHeight: 34, cadenceTicks: 12 }),
    Object.freeze({ id: 'rug-wind', label: 'Rug Wind', driftPerTick: 0.08, cadenceTicks: 9 }),
  ]),
  pickups: Object.freeze([
    Object.freeze({ id: 'litecoin', label: 'Litecoin', value: 25, cadenceTicks: 7 }),
  ]),
  achievements: Object.freeze([
    Object.freeze({ id: 'chikun-first-flight', title: 'First Flight', condition: 'survive at least 10 ticks' }),
    Object.freeze({ id: 'chikun-stack-three', title: 'Stack Three', condition: 'collect at least 3 Litecoin coins' }),
  ]),
});

export function buildChikunVerticalSliceConfig() {
  return CHIKUN_VERTICAL_SLICE_CONFIG;
}

function normalizeSeed(value) {
  return Math.floor(Number(value) || 0) >>> 0;
}

function normalizeMaxTicks(value) {
  const ticks = Math.floor(Number(value));
  if (!Number.isFinite(ticks)) return 60;
  return Math.max(1, Math.min(CHIKUN_MAX_RUN_TICKS, ticks));
}

function normalizeFlapSteps(taps, maxTicks) {
  const raw = Array.isArray(taps) ? taps : [];
  if (raw.length > CHIKUN_MAX_FLAP_TRANSITIONS) {
    throw new Error(`Chikun flap evidence exceeds ${CHIKUN_MAX_FLAP_TRANSITIONS} transitions`);
  }
  const unique = new Set();
  for (const value of raw) {
    const step = Math.max(0, Math.floor(Number(value) || 0));
    if (step < maxTicks) unique.add(step);
  }
  const flapSteps = [...unique].sort((a, b) => a - b);
  if (flapSteps.length > CHIKUN_MAX_FLAP_TRANSITIONS) {
    throw new Error(`Chikun flap evidence exceeds ${CHIKUN_MAX_FLAP_TRANSITIONS} transitions`);
  }
  return Object.freeze(flapSteps);
}

function buildChikunEvidence({ seed, taps, maxTicks }) {
  const normalizedMaxTicks = normalizeMaxTicks(maxTicks);
  return Object.freeze({
    version: CHIKUN_EVIDENCE_VERSION,
    seed: normalizeSeed(seed),
    fixedStepHz: CHIKUN_FIXED_STEP_HZ,
    maxTicks: normalizedMaxTicks,
    flapSteps: normalizeFlapSteps(taps, normalizedMaxTicks),
  });
}

function deterministicRoll(seed, tick, salt = 0) {
  let x = Math.imul((seed >>> 0) ^ Math.imul(tick + 1, 0x9e3779b1) ^ salt, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 0xffffffff;
}

function simulateCanonicalEvidence(evidence) {
  const tapSet = new Set(evidence.flapSteps);
  const cfg = CHIKUN_VERTICAL_SLICE_CONFIG;
  let y = 52;
  let velocity = 0;
  let score = 0;
  let coinsCollected = 0;
  let forksPassed = 0;
  let survivedTicks = 0;
  let crashed = false;

  for (let tick = 0; tick < evidence.maxTicks; tick += 1) {
    if (tapSet.has(tick)) velocity = cfg.rules.flapImpulse;
    velocity += cfg.rules.gravityPerTick;
    const wind = tick % cfg.hazards[1].cadenceTicks === 0
      ? (deterministicRoll(evidence.seed, tick, 19) - 0.5) * 2 * cfg.hazards[1].driftPerTick
      : 0;
    y += velocity + wind;
    survivedTicks = tick + 1;

    if (y <= cfg.rules.ceilingY || y >= cfg.rules.floorY) {
      crashed = true;
      break;
    }

    if (tick > 0 && tick % cfg.hazards[0].cadenceTicks === 0) {
      const gapCenter = 22 + deterministicRoll(evidence.seed, tick, 7) * 56;
      const halfGap = cfg.hazards[0].safeGapHeight / 2;
      if (y < gapCenter - halfGap || y > gapCenter + halfGap) {
        crashed = true;
        break;
      }
      forksPassed += 1;
      score += cfg.rules.score.forkPassValue;
    }

    if (tick > 0 && tick % cfg.pickups[0].cadenceTicks === 0) {
      const coinY = 18 + deterministicRoll(evidence.seed, tick, 55) * 64;
      if (Math.abs(y - coinY) <= 18) {
        coinsCollected += 1;
        score += cfg.rules.score.coinValue;
      }
    }

    score += cfg.rules.score.survivalTickValue;
  }

  const achievements = [];
  if (survivedTicks >= 10) achievements.push('chikun-first-flight');
  if (coinsCollected >= 3) achievements.push('chikun-stack-three');

  const survivalTime = Number((survivedTicks / CHIKUN_FIXED_STEP_HZ).toFixed(6));
  const finalState = Object.freeze({
    step: survivedTicks,
    y: Number(y.toFixed(6)),
    velocity: Number(velocity.toFixed(6)),
    score: Math.max(0, Math.round(score)),
    coinsCollected,
    forksPassed,
    survivalTicks: survivedTicks,
    survivalTime,
    crashed,
  });

  return Object.freeze({
    gameId: 'chikun',
    seed: evidence.seed,
    fixedStepHz: CHIKUN_FIXED_STEP_HZ,
    score: finalState.score,
    coinsCollected,
    forksPassed,
    survivalTicks: survivedTicks,
    survivalTime,
    crashed,
    achievements: Object.freeze(achievements),
    finalState,
    evidence,
  });
}

export function simulateChikunRun({ seed = 1, taps = [], maxTicks = 60 } = {}) {
  return simulateCanonicalEvidence(buildChikunEvidence({ seed, taps, maxTicks }));
}

export function replayChikunRun(evidence = {}) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new Error('Chikun replay evidence must be an object');
  }
  if (evidence.version !== CHIKUN_EVIDENCE_VERSION) {
    throw new Error(`Unsupported Chikun evidence version: ${String(evidence.version ?? '')}`);
  }
  if (evidence.fixedStepHz !== CHIKUN_FIXED_STEP_HZ) {
    throw new Error(`Chikun evidence fixedStepHz must be ${CHIKUN_FIXED_STEP_HZ}`);
  }
  const maxTicks = Math.floor(Number(evidence.maxTicks));
  if (!Number.isFinite(maxTicks) || maxTicks < 1 || maxTicks > CHIKUN_MAX_RUN_TICKS) {
    throw new Error('Chikun evidence maxTicks is outside the supported run budget');
  }
  if (!Array.isArray(evidence.flapSteps)) {
    throw new Error('Chikun evidence flapSteps must be an array');
  }
  if (evidence.flapSteps.length > CHIKUN_MAX_FLAP_TRANSITIONS) {
    throw new Error(`Chikun flap evidence exceeds ${CHIKUN_MAX_FLAP_TRANSITIONS} transitions`);
  }
  let previousStep = -1;
  for (const value of evidence.flapSteps) {
    if (!Number.isInteger(value) || value < 0 || value >= maxTicks) {
      throw new Error('Chikun evidence flapSteps must be integers within maxTicks');
    }
    if (value <= previousStep) {
      throw new Error('Chikun evidence flapSteps must be strictly increasing');
    }
    previousStep = value;
  }
  return simulateCanonicalEvidence(buildChikunEvidence({
    seed: evidence.seed,
    taps: evidence.flapSteps,
    maxTicks,
  }));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertCanonicalChikunResult(result, replayed) {
  for (const field of ['seed', 'score', 'coinsCollected', 'forksPassed', 'survivalTicks', 'survivalTime', 'crashed']) {
    if (result?.[field] !== replayed[field]) throw new Error(`Chikun result ${field} does not match canonical replay`);
  }
  if (!sameJson(result?.achievements, replayed.achievements)) throw new Error('Chikun result achievements do not match canonical replay');
  if (!sameJson(result?.finalState, replayed.finalState)) throw new Error('Chikun result finalState does not match canonical replay');
}

export function buildChikunReplayClaim({ buildHash, seasonId, result } = {}) {
  if (typeof buildHash !== 'string' || !buildHash.trim()) throw new Error('Chikun replay buildHash is required');
  if (typeof seasonId !== 'string' || !seasonId.trim()) throw new Error('Chikun replay seasonId is required');
  const replayed = replayChikunRun(result?.evidence);
  assertCanonicalChikunResult(result, replayed);
  return Object.freeze({
    version: 'chikun-parent-replay-v1',
    seed: replayed.seed,
    buildHash: buildHash.trim(),
    seasonId: seasonId.trim(),
    evidence: replayed.evidence,
    finalState: replayed.finalState,
  });
}

export function verifyChikunReplayClaim({ expectedSeed, expectedBuildHash, expectedSeasonId, score, runStats = {}, replayClaim } = {}) {
  if (!replayClaim || typeof replayClaim !== 'object' || Array.isArray(replayClaim)) throw new Error('Chikun replay claim is required');
  if (replayClaim.version !== 'chikun-parent-replay-v1') throw new Error('Unsupported Chikun parent replay claim version');
  if (replayClaim.seed !== expectedSeed || replayClaim.buildHash !== expectedBuildHash || replayClaim.seasonId !== expectedSeasonId) {
    throw new Error('Chikun replay claim does not match the parent session binding');
  }
  const replayed = replayChikunRun(replayClaim.evidence);
  if (replayed.seed !== expectedSeed) throw new Error('Chikun replay seed does not match the parent session seed');
  if (!sameJson(replayClaim.finalState, replayed.finalState)) throw new Error('Chikun replay finalState does not match canonical replay');
  if (score !== replayed.score) throw new Error('Chikun submitted score does not match canonical replay');
  for (const field of ['coinsCollected', 'forksPassed', 'survivalTicks', 'survivalTime']) {
    if (runStats?.[field] !== replayed[field]) throw new Error(`Chikun submitted ${field} does not match canonical replay`);
  }
  if (!sameJson(runStats?.achievements, replayed.achievements)) throw new Error('Chikun submitted achievements do not match canonical replay');
  return replayed;
}

export function createChikunCabinet({ sessionId = null } = {}) {
  const adapter = createInProcessGameAdapter({ gameId: 'chikun', sessionId, rankedEligible: true });
  return Object.freeze({
    id: 'chikun',
    config: CHIKUN_VERTICAL_SLICE_CONFIG,
    adapter,
    init(context = {}) {
      return adapter.init({ rankedEligible: true, ...context });
    },
    start(config = {}) {
      return adapter.start({ mode: config.mode ?? 'free' });
    },
    simulate(options = {}) {
      const context = adapter.getInitContext();
      const seed = context?.mode === 'ranked'
        ? context.seed
        : (options.seed ?? context?.seed ?? 1);
      const result = simulateChikunRun({ ...options, seed });
      adapter.emitStatUpdate({ score: result.score, kills: 0, survivalTime: result.survivalTime });
      return result;
    },
    submitRun(result = {}) {
      const context = adapter.getInitContext();
      const buildHash = context?.buildHash ?? `cabinet-${CHIKUN_CABINET_VERSION}`;
      const seasonId = context?.seasonId ?? 'chikun-free-practice';
      const replayClaim = buildChikunReplayClaim({ buildHash, seasonId, result });
      const runStats = {
        survivalTime: result.survivalTime,
        survivalTicks: result.survivalTicks,
        coinsCollected: result.coinsCollected,
        forksPassed: result.forksPassed,
        achievements: result.achievements,
      };
      const canonical = verifyChikunReplayClaim({
        expectedSeed: context?.mode === 'ranked' ? context.seed : replayClaim.seed,
        expectedBuildHash: buildHash,
        expectedSeasonId: seasonId,
        score: result.score,
        runStats,
        replayClaim,
      });
      const safe = Object.freeze({
        score: canonical.score,
        survivalTime: canonical.survivalTime,
        survivalTicks: canonical.survivalTicks,
        coinsCollected: canonical.coinsCollected,
        forksPassed: canonical.forksPassed,
        achievements: canonical.achievements,
        evidence: canonical.evidence,
        finalState: canonical.finalState,
        replayClaim,
      });
      const submitted = adapter.submitScore(safe.score, { ...runStats, replayClaim });
      if (!submitted) throw new Error('Chikun score intent failed SDK validation');
      adapter.end({ score: safe.score, survivalTime: safe.survivalTime });
      return safe;
    },
    teardown() {
      return adapter.teardown();
    },
  });
}

export async function loadChikunGame() {
  const manifest = Object.freeze({
    id: 'chikun',
    title: CHIKUN_VERTICAL_SLICE_CONFIG.title,
    version: CHIKUN_CABINET_VERSION,
    runtimeVersion: CHIKUN_RUNTIME_VERSION,
    config: CHIKUN_VERTICAL_SLICE_CONFIG,
    assets: Object.freeze([
      './assets/cabinet-chikun.svg',
      './assets/cartridge-chikun.svg',
      './assets/generated/chikun-cabinet/chikun-cabinet-front.png?v=transparent-v2',
    ]),
  });
  return Object.freeze({
    manifest,
    entryPoint({ sessionId = null } = {}) {
      return Object.freeze({ loaded: true, manifest, cabinet: createChikunCabinet({ sessionId }) });
    },
    adapter: Object.freeze({
      normalizeStats(raw = {}) {
        return Object.freeze({
          score: Math.max(0, Math.round(Number(raw.score) || 0)),
          coinsCollected: Math.max(0, Math.round(Number(raw.coinsCollected) || 0)),
          forksPassed: Math.max(0, Math.round(Number(raw.forksPassed) || 0)),
          survivalTicks: Math.max(0, Math.round(Number(raw.survivalTicks) || 0)),
          survivalTime: Math.max(0, Number(raw.survivalTime ?? raw.survivalTimeSeconds) || 0),
          achievements: Object.freeze(Array.isArray(raw.achievements) ? [...raw.achievements] : []),
        });
      },
    }),
  });
}
