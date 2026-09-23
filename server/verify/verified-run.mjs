// Shared by the per-game verifiers (contract §5.3). Server only.
//
// - buildVerifiedRun: the frozen VerifiedRun of §5.3 (A12 clamps, the v2
//   envelope hash of §2.6, the stored evidence text, bytes and digest).
// - invalid / rejected / scoreOutOfBounds: the error shapes (400 and 422).
// - RUN_STATS_MAPPERS: the §6.3 stats mappers.
//
// index.mjs imports the per-game modules lazily, so this shared code lives here
// rather than in index.mjs (which would make an import cycle).
//
// Stats: the mappers are exactly statsFromChikunResult, statsFromStackedTuple
// and statsFromHmhRunSummary of apps/portal/src/achievements/stats.mjs
// (achievements slice, §6.3), imported statically, so there is one copy of
// them. A missing or broken stats module therefore breaks every per-game
// verifier that imports this file (chikun.mjs, stacked.mjs, hmh.mjs). Those
// load lazily, per request (index.mjs, and settle's loadHeroGates for
// hmh.mjs), so the failure shows at request time, not at deploy time: an HMH
// settle or ticket answers 503 settlement-not-configured with detail
// hero-gates-unavailable, a Chikun or STACKED replay throws (settle answers
// 500 internal-error and the cron waits), and settle logs each failed import
// by error name and code. The verify slice's interim fallback (a mirror of
// those mappers, kept while its base lacked the achievements slice) was
// removed at the settle-wiring integration, after it gave deepEqual stats on
// every committed ranked fixture.
import { statsFromChikunResult, statsFromHmhRunSummary, statsFromStackedTuple } from '../../apps/portal/src/achievements/stats.mjs';
import { RANKED_GAMES, rankedEnvelopeHash } from '../../apps/portal/src/ranked-identity.mjs';

export const RUN_STATS_MAPPER_NAMES = Object.freeze(['statsFromChikunResult', 'statsFromStackedTuple', 'statsFromHmhRunSummary']);
// What each per-game verifier's `stats(mappers)` callback receives.
export const RUN_STATS_MAPPERS = Object.freeze({ statsFromChikunResult, statsFromStackedTuple, statsFromHmhRunSummary });

// ---------------------------------------------------------------------------
// Error shapes. Every failure is { ok:false, status, error, detail?, flags? }.

export const MAX_RANKED_SCORE = 10_000_000_000;
// A12 clamps for the contract fields (stats keep the unclamped values).
export const CONTRACT_BOUNDS = Object.freeze({ kills: 100_000, maxCombo: 10_000, survivalSeconds: 86_400 });

export const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));

export function invalid(error, detail) {
  return Object.freeze({ ok: false, status: 400, error, ...(detail ? { detail: String(detail).slice(0, 240) } : {}) });
}

export function rejected(error, extra = {}) {
  return Object.freeze({ ok: false, status: 422, error, ...extra });
}

export function scoreOutOfBounds(score) {
  return rejected('score-out-of-bounds', { detail: `score ${String(score)} exceeds ${MAX_RANKED_SCORE}` });
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const clampCount = (value, maximum) => Math.min(maximum, Math.max(0, Math.floor(Number(value) || 0)));

// → Promise<VerifiedRun | failure>. `identity` is the canonical identity (with
// version and sessionKey). `stats` receives RUN_STATS_MAPPERS and returns the
// §6.3 stats.
//
// Throw policy (contract §5.3 and §6.3 are silent; this is the verify rule):
// the mappers run only on a server-replayed result or tuple, or on an HMH
// summary that already passed the schema and plausibility checks, so a mapper
// that throws there is a server-side inconsistency, not the player's fault. It
// propagates (settle answers a retryable 500) instead of rejecting a paid run
// for good with a 422. The achievements stats.mjs header says the opposite
// ("the server verifier treats that as a rejected run"); that comment is the
// achievements slice's to correct.
export async function buildVerifiedRun({ identity, nowMs, score, stats, contract, evidence, plausibility = null }) {
  if (!Number.isFinite(nowMs)) throw new TypeError('nowMs is required to stamp verifiedAt');
  const game = RANKED_GAMES[identity.gameId];
  if (!game) throw new TypeError(`unknown ranked gameId: ${String(identity.gameId)}`);
  if (!Number.isSafeInteger(score) || score < 0) return rejected('replay-rejected', { detail: 'score' });
  if (score > MAX_RANKED_SCORE) return scoreOutOfBounds(score);
  const runStats = stats(RUN_STATS_MAPPERS);
  const bytes = new TextEncoder().encode(evidence.text).length;
  const envelopeHash = await rankedEnvelopeHash({ gameId: identity.gameId, sessionId32: identity.sessionKey, encoding: evidence.encoding, evidenceDigest: evidence.digest });
  return deepFreeze({
    ok: true,
    gameId: identity.gameId,
    sessionId32: identity.sessionKey,
    sessionHandle: identity.sessionId,
    wallet: identity.wallet,
    seasonId: identity.seasonId,
    runtimeId: game.runtimeId,
    buildHash: identity.buildHash,
    seed: identity.seed,
    score,
    contract: {
      kills: clampCount(contract.kills, CONTRACT_BOUNDS.kills),
      maxCombo: clampCount(contract.maxCombo, CONTRACT_BOUNDS.maxCombo),
      survivalSeconds: clampCount(contract.survivalSeconds, CONTRACT_BOUNDS.survivalSeconds),
      bossId: contract.bossId ?? null,
    },
    stats: runStats,
    evidence: { encoding: evidence.encoding, text: evidence.text, bytes, digest: evidence.digest },
    envelopeHash,
    identity: { ...identity },
    plausibility,
    verifiedAt: new Date(nowMs).toISOString(),
  });
}
