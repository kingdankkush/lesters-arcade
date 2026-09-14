import { createChikunRuntime as createLegacyRuntime } from './chikun-flight-legacy.mjs';
import { createGroundRuntime, groundDifficulty } from './chikun-ground-runtime.mjs';
import { ARCADE_SDK_VERSION } from './arcade-sdk.mjs';
import { createInProcessGameAdapter } from './game-adapter.mjs';

export const CHIKUN_CABINET_VERSION = '0.7.0';
export const CHIKUN_RUNTIME_VERSION = 'canvas-runtime-v5';
export const CHIKUN_FIXED_STEP_HZ = 60;
export const CHIKUN_MAX_FLAP_TRANSITIONS = 4_096;
const CHIKUN_MAX_RUN_TICKS = CHIKUN_FIXED_STEP_HZ * 60 * 60;
export const CHIKUN_EVIDENCE_VERSION = 'chikun-flap-evidence-v3';
const LEGACY_EVIDENCE_VERSION = 'chikun-flap-evidence-v1';

export const CHIKUN_VERTICAL_SLICE_CONFIG = Object.freeze({
  gameId: 'chikun',
  title: "Chikun's Escape",
  version: CHIKUN_CABINET_VERSION,
  runtimeVersion: CHIKUN_RUNTIME_VERSION,
  sdkVersion: ARCADE_SDK_VERSION,
  canvas: Object.freeze({ width: 1280, height: 720 }),
  chikun: Object.freeze({ x: 280, startY: 660, hitRadius: 30, renderSize: 112 }),
  rules: Object.freeze({
    input: 'tap-jump-tap-fly',
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

function buildChikunEvidence({ seed, taps, maxTicks, evidenceVersion = CHIKUN_EVIDENCE_VERSION }) {
  if (![CHIKUN_EVIDENCE_VERSION, LEGACY_EVIDENCE_VERSION, "chikun-flap-evidence-v2"].includes(evidenceVersion)) throw new Error("Unsupported Chikun evidence version");
  const normalizedMaxTicks = normalizeMaxTicks(maxTicks);
  return Object.freeze({
    version: evidenceVersion,
    seed: normalizeSeed(seed),
    fixedStepHz: CHIKUN_FIXED_STEP_HZ,
    maxTicks: normalizedMaxTicks,
    flapSteps: normalizeFlapSteps(taps, normalizedMaxTicks),
  });
}

export const buildChikunDifficulty = groundDifficulty;
export function createChikunRuntime({ seed = 1, maxTicks = 60, evidenceVersion = CHIKUN_EVIDENCE_VERSION } = {}) {
 if (evidenceVersion === CHIKUN_EVIDENCE_VERSION) return createGroundRuntime({seed,maxTicks});
 if (['chikun-flap-evidence-v1','chikun-flap-evidence-v2'].includes(evidenceVersion)) return createLegacyRuntime({seed,maxTicks,evidenceVersion});
 throw new Error('Unsupported Chikun evidence version');
}

export function simulateChikunRun({ seed = 1, taps = [], maxTicks = 60, evidenceVersion = CHIKUN_EVIDENCE_VERSION } = {}) {
  const evidence = buildChikunEvidence({ seed, taps, maxTicks, evidenceVersion });
  const tapSet = new Set(evidence.flapSteps);
  const runtime = createChikunRuntime({ seed: evidence.seed, maxTicks: evidence.maxTicks, evidenceVersion: evidence.version });
  while (!runtime.terminal) {
    const tick = runtime.snapshot().tick;
    runtime.step({ flap: tapSet.has(tick) });
  }
  return runtime.result();
}

export function replayChikunRun(evidence = {}) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw new Error('Chikun replay evidence must be an object');
  if (![CHIKUN_EVIDENCE_VERSION, LEGACY_EVIDENCE_VERSION, "chikun-flap-evidence-v2"].includes(evidence.version)) throw new Error(`Unsupported Chikun evidence version: ${String(evidence.version ?? '')}`);
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
  return simulateChikunRun({ seed: evidence.seed, taps: evidence.flapSteps, maxTicks, evidenceVersion: evidence.version });
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
  if (replayClaim.evidence?.version !== CHIKUN_EVIDENCE_VERSION) throw new Error("Chikun course evidence version does not match the current cabinet");
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
