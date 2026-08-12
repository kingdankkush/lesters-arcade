import { ARCADE_SDK_VERSION } from './arcade-sdk.mjs';
import { createInProcessGameAdapter } from './game-adapter.mjs';

export const CHIKUN_CABINET_VERSION = '0.4.0';
export const CHIKUN_RUNTIME_VERSION = 'canvas-runtime-v2';
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
  canvas: Object.freeze({ width: 1280, height: 720 }),
  chikun: Object.freeze({ x: 280, startY: 360, hitRadius: 30, renderSize: 112 }),
  rules: Object.freeze({
    input: 'tap-to-flap',
    fixedStepHz: CHIKUN_FIXED_STEP_HZ,
    gravityPerTick: 0.09,
    flapImpulse: -3.6,
    maxFallVelocity: 5,
    ceilingY: 30,
    floorY: 690,
    scrollPixelsPerTick: 2.4,
    score: Object.freeze({ coinValue: 25, forkPassValue: 10, nearMissValue: 40, survivalTickValue: 1 }),
    difficulty: Object.freeze({
      ticksPerLevel: 480,
      maximumLevel: 7,
      gapReductionPerLevel: 14,
      minimumGapHeight: 238,
      scrollIncreasePerLevel: 0.16,
      maximumScrollPixelsPerTick: 3.35,
      nearMissClearance: 42,
    }),
  }),
  hazards: Object.freeze([
    Object.freeze({ id: 'fork-gap', label: 'Big Corp Fork Gap', width: 130, safeGapHeight: 320, cadenceTicks: 267, spacingPixels: 640, firstOffsetPixels: -320 }),
    Object.freeze({ id: 'rug-wind', label: 'Rug Wind', driftPerTick: 0.015, cadenceTicks: 45 }),
  ]),
  pickups: Object.freeze([
    Object.freeze({ id: 'litecoin', label: 'Litecoin', value: 25, radius: 24 }),
  ]),
  achievements: Object.freeze([
    Object.freeze({ id: 'chikun-first-flight', title: 'First Flight', condition: 'survive at least 10 ticks' }),
    Object.freeze({ id: 'chikun-stack-three', title: 'Stack Three', condition: 'collect at least 3 Litecoin coins' }),
    Object.freeze({ id: 'chikun-fork-runner', title: 'Fork Runner', condition: 'pass at least 5 Big Corp forks' }),
    Object.freeze({ id: 'chikun-thread-needle', title: 'Thread the Needle', condition: 'earn at least 3 near misses' }),
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

function deterministicRoll(seed, index, salt = 0) {
  let x = Math.imul((seed >>> 0) ^ Math.imul(index + 1, 0x9e3779b1) ^ salt, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 0xffffffff;
}

export function buildChikunDifficulty(tick = 0) {
  const cfg = CHIKUN_VERTICAL_SLICE_CONFIG;
  const policy = cfg.rules.difficulty;
  const normalizedTick = Math.max(0, Math.floor(Number(tick) || 0));
  const level = Math.min(policy.maximumLevel, Math.floor(normalizedTick / policy.ticksPerLevel) + 1);
  const completedLevels = level - 1;
  return Object.freeze({
    level,
    safeGapHeight: Math.max(policy.minimumGapHeight, cfg.hazards[0].safeGapHeight - completedLevels * policy.gapReductionPerLevel),
    scrollPixelsPerTick: Math.min(policy.maximumScrollPixelsPerTick, cfg.rules.scrollPixelsPerTick + completedLevels * policy.scrollIncreasePerLevel),
  });
}

function traveledPixelsAtTick(tick) {
  const policy = CHIKUN_VERTICAL_SLICE_CONFIG.rules.difficulty;
  const normalizedTick = Math.max(0, Math.floor(Number(tick) || 0));
  let remaining = normalizedTick;
  let traveled = 0;
  for (let level = 1; remaining > 0 && level <= policy.maximumLevel; level += 1) {
    const levelTicks = level === policy.maximumLevel ? remaining : Math.min(remaining, policy.ticksPerLevel);
    traveled += levelTicks * buildChikunDifficulty((level - 1) * policy.ticksPerLevel).scrollPixelsPerTick;
    remaining -= levelTicks;
  }
  return traveled;
}

function forkGeometry(seed, index, tick) {
  const cfg = CHIKUN_VERTICAL_SLICE_CONFIG;
  const hazard = cfg.hazards[0];
  const gapHalf = buildChikunDifficulty(tick).safeGapHeight / 2;
  const gapCenter = gapHalf + 38 + deterministicRoll(seed, index, 7) * (cfg.canvas.height - (gapHalf + 38) * 2);
  const x = cfg.canvas.width + hazard.firstOffsetPixels + index * hazard.spacingPixels - traveledPixelsAtTick(tick);
  return {
    id: `fork-${index}`,
    index,
    x,
    width: hazard.width,
    gapCenter,
    gapTop: gapCenter - gapHalf,
    gapBottom: gapCenter + gapHalf,
    coin: { x: x + hazard.width / 2, y: gapCenter, radius: cfg.pickups[0].radius },
  };
}

function relevantForks(seed, tick) {
  const cfg = CHIKUN_VERTICAL_SLICE_CONFIG;
  const hazard = cfg.hazards[0];
  const traveled = traveledPixelsAtTick(tick);
  const firstIndex = Math.max(0, Math.floor((traveled - cfg.canvas.width - hazard.firstOffsetPixels - hazard.width) / hazard.spacingPixels));
  const forks = [];
  for (let index = firstIndex; index < firstIndex + 5; index += 1) {
    const fork = forkGeometry(seed, index, tick);
    if (fork.x > -hazard.width && fork.x < cfg.canvas.width + hazard.spacingPixels) forks.push(fork);
  }
  return forks;
}

function freezeSnapshot(state) {
  const cfg = CHIKUN_VERTICAL_SLICE_CONFIG;
  const forks = relevantForks(state.seed, state.tick).map((fork) => Object.freeze({
    ...fork,
    coin: Object.freeze({ ...fork.coin, collected: state.collectedCoins.has(fork.index) }),
    passed: state.passedForks.has(fork.index),
  }));
  return Object.freeze({
    canvas: cfg.canvas,
    tick: state.tick,
    elapsedSeconds: Number((state.tick / CHIKUN_FIXED_STEP_HZ).toFixed(6)),
    terminal: state.terminal,
    terminalReason: state.terminalReason,
    score: Math.max(0, Math.round(state.score)),
    coinsCollected: state.coinsCollected,
    forksPassed: state.forksPassed,
    nearMisses: state.nearMisses,
    combo: state.combo,
    bestCombo: state.bestCombo,
    difficulty: buildChikunDifficulty(state.tick),
    chikun: Object.freeze({
      x: cfg.chikun.x,
      y: Number(state.y.toFixed(6)),
      velocityY: Number(state.velocity.toFixed(6)),
      radius: cfg.chikun.hitRadius,
    }),
    forks: Object.freeze(forks),
  });
}

function buildRuntimeResult(state) {
  const survivalTime = Number((state.tick / CHIKUN_FIXED_STEP_HZ).toFixed(6));
  const achievements = [];
  if (state.tick >= 10) achievements.push('chikun-first-flight');
  if (state.coinsCollected >= 3) achievements.push('chikun-stack-three');
  if (state.forksPassed >= 5) achievements.push('chikun-fork-runner');
  if (state.nearMisses >= 3) achievements.push('chikun-thread-needle');
  const evidence = buildChikunEvidence({ seed: state.seed, taps: state.flapSteps, maxTicks: state.maxTicks });
  const finalState = Object.freeze({
    step: state.tick,
    y: Number(state.y.toFixed(6)),
    velocity: Number(state.velocity.toFixed(6)),
    score: Math.max(0, Math.round(state.score)),
    coinsCollected: state.coinsCollected,
    forksPassed: state.forksPassed,
    nearMisses: state.nearMisses,
    bestCombo: state.bestCombo,
    survivalTicks: state.tick,
    survivalTime,
    crashed: state.terminalReason !== 'run-complete',
    terminalReason: state.terminalReason,
  });
  return Object.freeze({
    gameId: 'chikun',
    seed: state.seed,
    fixedStepHz: CHIKUN_FIXED_STEP_HZ,
    score: finalState.score,
    coinsCollected: state.coinsCollected,
    forksPassed: state.forksPassed,
    nearMisses: state.nearMisses,
    bestCombo: state.bestCombo,
    survivalTicks: state.tick,
    survivalTime,
    crashed: finalState.crashed,
    achievements: Object.freeze(achievements),
    finalState,
    evidence,
  });
}

export function createChikunRuntime({ seed = 1, maxTicks = 60 } = {}) {
  const cfg = CHIKUN_VERTICAL_SLICE_CONFIG;
  const state = {
    seed: normalizeSeed(seed),
    maxTicks: normalizeMaxTicks(maxTicks),
    tick: 0,
    y: cfg.chikun.startY,
    velocity: 0,
    score: 0,
    coinsCollected: 0,
    forksPassed: 0,
    nearMisses: 0,
    combo: 0,
    bestCombo: 0,
    flapSteps: [],
    passedForks: new Set(),
    collectedCoins: new Set(),
    terminal: false,
    terminalReason: '',
    result: null,
  };

  const finalize = (reason) => {
    if (state.terminal) return;
    state.terminal = true;
    state.terminalReason = reason;
    state.result = buildRuntimeResult(state);
  };

  const step = ({ flap = false } = {}) => {
    if (state.terminal) throw new Error('Chikun runtime is already terminal');
    if (typeof flap !== 'boolean') throw new Error('Chikun runtime flap must be boolean');
    const tick = state.tick;
    if (flap) {
      if (state.flapSteps.length >= CHIKUN_MAX_FLAP_TRANSITIONS) throw new Error(`Chikun flap evidence exceeds ${CHIKUN_MAX_FLAP_TRANSITIONS} transitions`);
      state.flapSteps.push(tick);
      state.velocity = cfg.rules.flapImpulse;
    }
    state.velocity = Math.min(cfg.rules.maxFallVelocity, state.velocity + cfg.rules.gravityPerTick);
    const wind = tick % cfg.hazards[1].cadenceTicks === 0
      ? (deterministicRoll(state.seed, tick, 19) - 0.5) * 2 * cfg.hazards[1].driftPerTick
      : 0;
    state.y += state.velocity + wind;
    state.tick += 1;

    if (state.y - cfg.chikun.hitRadius <= cfg.rules.ceilingY || state.y + cfg.chikun.hitRadius >= cfg.rules.floorY) {
      finalize(state.y < cfg.canvas.height / 2 ? 'ceiling' : 'ground');
      return freezeSnapshot(state);
    }

    for (const fork of relevantForks(state.seed, state.tick)) {
      const overlapsX = cfg.chikun.x + cfg.chikun.hitRadius > fork.x
        && cfg.chikun.x - cfg.chikun.hitRadius < fork.x + fork.width;
      if (overlapsX && (state.y - cfg.chikun.hitRadius < fork.gapTop || state.y + cfg.chikun.hitRadius > fork.gapBottom)) {
        finalize('fork');
        return freezeSnapshot(state);
      }
      if (!state.collectedCoins.has(fork.index)) {
        const dx = fork.coin.x - cfg.chikun.x;
        const dy = fork.coin.y - state.y;
        if (Math.hypot(dx, dy) <= fork.coin.radius + cfg.chikun.hitRadius) {
          state.collectedCoins.add(fork.index);
          state.coinsCollected += 1;
          state.score += cfg.rules.score.coinValue;
        }
      }
      if (!state.passedForks.has(fork.index) && fork.x + fork.width < cfg.chikun.x - cfg.chikun.hitRadius) {
        state.passedForks.add(fork.index);
        state.forksPassed += 1;
        state.combo += 1;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        state.score += cfg.rules.score.forkPassValue;
        const topClearance = state.y - cfg.chikun.hitRadius - fork.gapTop;
        const bottomClearance = fork.gapBottom - (state.y + cfg.chikun.hitRadius);
        if (Math.min(topClearance, bottomClearance) <= cfg.rules.difficulty.nearMissClearance) {
          state.nearMisses += 1;
          state.score += cfg.rules.score.nearMissValue;
        }
      }
    }

    state.score += cfg.rules.score.survivalTickValue;
    if (state.tick >= state.maxTicks) finalize('run-complete');
    return freezeSnapshot(state);
  };

  return Object.freeze({
    step,
    snapshot: () => freezeSnapshot(state),
    result: () => state.result,
    get terminal() { return state.terminal; },
  });
}

export function simulateChikunRun({ seed = 1, taps = [], maxTicks = 60 } = {}) {
  const evidence = buildChikunEvidence({ seed, taps, maxTicks });
  const tapSet = new Set(evidence.flapSteps);
  const runtime = createChikunRuntime({ seed: evidence.seed, maxTicks: evidence.maxTicks });
  while (!runtime.terminal) {
    const tick = runtime.snapshot().tick;
    runtime.step({ flap: tapSet.has(tick) });
  }
  return runtime.result();
}

export function replayChikunRun(evidence = {}) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw new Error('Chikun replay evidence must be an object');
  if (evidence.version !== CHIKUN_EVIDENCE_VERSION) throw new Error(`Unsupported Chikun evidence version: ${String(evidence.version ?? '')}`);
  if (evidence.fixedStepHz !== CHIKUN_FIXED_STEP_HZ) throw new Error(`Chikun evidence fixedStepHz must be ${CHIKUN_FIXED_STEP_HZ}`);
  const maxTicks = Math.floor(Number(evidence.maxTicks));
  if (!Number.isFinite(maxTicks) || maxTicks < 1 || maxTicks > CHIKUN_MAX_RUN_TICKS) throw new Error('Chikun evidence maxTicks is outside the supported run budget');
  if (!Array.isArray(evidence.flapSteps)) throw new Error('Chikun evidence flapSteps must be an array');
  if (evidence.flapSteps.length > CHIKUN_MAX_FLAP_TRANSITIONS) throw new Error(`Chikun flap evidence exceeds ${CHIKUN_MAX_FLAP_TRANSITIONS} transitions`);
  let previousStep = -1;
  for (const value of evidence.flapSteps) {
    if (!Number.isInteger(value) || value < 0 || value >= maxTicks) throw new Error('Chikun evidence flapSteps must be integers within maxTicks');
    if (value <= previousStep) throw new Error('Chikun evidence flapSteps must be strictly increasing');
    previousStep = value;
  }
  return simulateChikunRun({ seed: evidence.seed, taps: evidence.flapSteps, maxTicks });
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertCanonicalChikunResult(result, replayed) {
  for (const field of ['seed', 'score', 'coinsCollected', 'forksPassed', 'nearMisses', 'bestCombo', 'survivalTicks', 'survivalTime', 'crashed']) {
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
  for (const field of ['coinsCollected', 'forksPassed', 'nearMisses', 'bestCombo', 'survivalTicks', 'survivalTime']) {
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
    init(context = {}) { return adapter.init({ rankedEligible: true, ...context }); },
    start(config = {}) { return adapter.start({ mode: config.mode ?? 'free' }); },
    simulate(options = {}) {
      const context = adapter.getInitContext();
      const seed = context?.mode === 'ranked' ? context.seed : (options.seed ?? context?.seed ?? 1);
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
        elapsedSeconds: result.survivalTime,
        survivalTime: result.survivalTime,
        survivalTicks: result.survivalTicks,
        coinsCollected: result.coinsCollected,
        forksPassed: result.forksPassed,
        nearMisses: result.nearMisses,
        bestCombo: result.bestCombo,
        flapCount: result.evidence?.flapSteps?.length ?? 0,
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
      const safe = Object.freeze({ ...canonical, replayClaim });
      const submitted = adapter.submitScore(safe.score, { ...runStats, replayClaim });
      if (!submitted) throw new Error('Chikun score intent failed SDK validation');
      adapter.end({ score: safe.score, survivalTime: safe.survivalTime });
      return safe;
    },
    teardown() { return adapter.teardown(); },
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
      './assets/generated/chikun-game/chikun-coast.webp',
      './assets/generated/chikun-game/chikun-fall.webp',
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
          nearMisses: Math.max(0, Math.round(Number(raw.nearMisses) || 0)),
          bestCombo: Math.max(0, Math.round(Number(raw.bestCombo) || 0)),
          survivalTicks: Math.max(0, Math.round(Number(raw.survivalTicks) || 0)),
          survivalTime: Math.max(0, Number(raw.survivalTime ?? raw.survivalTimeSeconds) || 0),
          achievements: Object.freeze(Array.isArray(raw.achievements) ? [...raw.achievements] : []),
        });
      },
    }),
  });
}
