import { ARCADE_SDK_VERSION } from './arcade-sdk.mjs';
import { createInProcessGameAdapter } from './game-adapter.mjs';

export const CHIKUN_VERTICAL_SLICE_CONFIG = Object.freeze({
  gameId: 'chikun',
  title: "Chikun's Escape",
  version: 'vertical-slice-v1',
  sdkVersion: ARCADE_SDK_VERSION,
  rules: Object.freeze({
    input: 'tap-to-flap',
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

function deterministicRoll(seed, tick, salt = 0) {
  let x = Math.imul((seed >>> 0) ^ Math.imul(tick + 1, 0x9e3779b1) ^ salt, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 0xffffffff;
}

export function simulateChikunRun({ seed = 1, taps = [], maxTicks = 60 } = {}) {
  const tapSet = new Set((Array.isArray(taps) ? taps : []).map((tick) => Math.max(0, Math.floor(Number(tick) || 0))));
  const cfg = CHIKUN_VERTICAL_SLICE_CONFIG;
  let y = 52;
  let velocity = 0;
  let score = 0;
  let coinsCollected = 0;
  let forksPassed = 0;
  let survivedTicks = 0;
  let crashed = false;

  for (let tick = 0; tick < Math.max(1, Math.floor(maxTicks)); tick += 1) {
    if (tapSet.has(tick)) velocity = cfg.rules.flapImpulse;
    velocity += cfg.rules.gravityPerTick;
    const wind = tick % cfg.hazards[1].cadenceTicks === 0 ? (deterministicRoll(seed, tick, 19) - 0.5) * 2 * cfg.hazards[1].driftPerTick : 0;
    y += velocity + wind;
    survivedTicks = tick + 1;

    if (y <= cfg.rules.ceilingY || y >= cfg.rules.floorY) {
      crashed = true;
      break;
    }

    if (tick > 0 && tick % cfg.hazards[0].cadenceTicks === 0) {
      const gapCenter = 22 + deterministicRoll(seed, tick, 7) * 56;
      const halfGap = cfg.hazards[0].safeGapHeight / 2;
      if (y < gapCenter - halfGap || y > gapCenter + halfGap) {
        crashed = true;
        break;
      }
      forksPassed += 1;
      score += cfg.rules.score.forkPassValue;
    }

    if (tick > 0 && tick % cfg.pickups[0].cadenceTicks === 0) {
      const coinY = 18 + deterministicRoll(seed, tick, 55) * 64;
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

  return Object.freeze({
    gameId: 'chikun',
    score: Math.max(0, Math.round(score)),
    coinsCollected,
    forksPassed,
    survivalTime: survivedTicks,
    crashed,
    achievements: Object.freeze(achievements),
  });
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
      const result = simulateChikunRun(options);
      adapter.emitStatUpdate({ score: result.score, kills: 0, survivalTime: result.survivalTime });
      return result;
    },
    submitRun(result = {}) {
      const safe = {
        score: Math.max(0, Math.round(Number(result.score) || 0)),
        survivalTime: Math.max(0, Math.round(Number(result.survivalTime) || 0)),
        coinsCollected: Math.max(0, Math.round(Number(result.coinsCollected) || 0)),
        achievements: Array.isArray(result.achievements) ? result.achievements : [],
      };
      adapter.submitScore(safe.score, { survivalTime: safe.survivalTime, coinsCollected: safe.coinsCollected });
      adapter.end({ score: safe.score, survivalTime: safe.survivalTime });
      return Object.freeze(safe);
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
    version: CHIKUN_VERTICAL_SLICE_CONFIG.version,
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
          survivalTime: Math.max(0, Math.round(Number(raw.survivalTime ?? raw.survivalTimeSeconds) || 0)),
          achievements: Object.freeze(Array.isArray(raw.achievements) ? [...raw.achievements] : []),
        });
      },
    }),
  });
}
