import { createChikunRuntime, replayChikunRun } from './chikun-cabinet.mjs';

export const CHIKUN_DAILY_CHALLENGE_VERSION = 'chikun-daily-v1';
export const CHIKUN_GHOST_STORAGE_VERSION = 'chikun-ghost-v1';
const MAX_GHOST_SAMPLES = 720;
const MS_PER_DAY = 86_400_000;

function normalizeSeed(value) {
  return Math.floor(Number(value) || 0) >>> 0;
}

function hashText(text) {
  let hash = 0x811c9dc5;
  for (const character of String(text)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function utcDayKey(now = Date.now()) {
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error('Chikun daily challenge now is invalid');
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function deriveChikunDailySeed(dayKey) {
  const key = String(dayKey ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('Chikun daily challenge dayKey must be YYYY-MM-DD');
  return hashText(`${CHIKUN_DAILY_CHALLENGE_VERSION}|chikun|${key}`);
}

export function buildChikunDailyChallenge({ now = Date.now() } = {}) {
  const dayKey = utcDayKey(now);
  return Object.freeze({
    version: CHIKUN_DAILY_CHALLENGE_VERSION,
    dayKey,
    seed: deriveChikunDailySeed(dayKey),
    label: `Daily ${dayKey}`,
  });
}

export function chikunDailyChallengeForSeed(seed, { now = Date.now() } = {}) {
  const normalized = normalizeSeed(seed);
  const today = buildChikunDailyChallenge({ now });
  if (today.seed === normalized) return today;
  const yesterday = buildChikunDailyChallenge({ now: Number(now) - MS_PER_DAY });
  if (yesterday.seed === normalized) return yesterday;
  return null;
}

export function matchesChikunDailyChallenge(seed, now = Date.now()) {
  return chikunDailyChallengeForSeed(seed, { now }) !== null;
}

export function bindChikunDailyChallenge(session, { now = Date.now() } = {}) {
  if (!session || session.gameId !== 'chikun') {
    throw new Error('Chikun daily challenge requires a Chikun session');
  }
  if (session.leaderboardEligible || session.mode === 'paid') {
    return { ...session, dailyChallenge: null };
  }
  const dailyChallenge = buildChikunDailyChallenge({ now });
  const canonicalContext = session.canonicalContext
    ? Object.freeze({ ...session.canonicalContext, seed: dailyChallenge.seed })
    : session.canonicalContext;
  return {
    ...session,
    seed: dailyChallenge.seed,
    canonicalContext,
    dailyChallenge,
  };
}

export function buildChikunGhostTrack(evidence) {
  const replayed = replayChikunRun(evidence);
  const tapSet = new Set(replayed.evidence.flapSteps);
  const runtime = createChikunRuntime({
    seed: replayed.seed,
    maxTicks: replayed.evidence.maxTicks,
  });
  const stride = Math.max(1, Math.ceil(Math.max(1, replayed.survivalTicks) / MAX_GHOST_SAMPLES));
  const samples = [];
  while (!runtime.terminal) {
    const snapshot = runtime.snapshot();
    if (snapshot.tick % stride === 0) {
      samples.push(Object.freeze({ tick: snapshot.tick, y: snapshot.chikun.y }));
    }
    runtime.step({ flap: tapSet.has(snapshot.tick) });
  }
  const terminal = runtime.snapshot();
  if (samples.at(-1)?.tick !== terminal.tick) {
    samples.push(Object.freeze({ tick: terminal.tick, y: terminal.chikun.y }));
  }
  return Object.freeze({
    seed: replayed.seed,
    score: replayed.score,
    survivalTicks: replayed.survivalTicks,
    terminalTick: terminal.tick,
    samples: Object.freeze(samples),
  });
}

export function ghostYAt(track, tick) {
  if (!track?.samples?.length) return null;
  const at = Math.max(0, Math.floor(Number(tick) || 0));
  if (at > track.terminalTick) return null;
  let previous = track.samples[0];
  for (const sample of track.samples) {
    if (sample.tick === at) return sample.y;
    if (sample.tick > at) {
      const span = sample.tick - previous.tick;
      if (span <= 0) return previous.y;
      const progress = (at - previous.tick) / span;
      return previous.y + (sample.y - previous.y) * progress;
    }
    previous = sample;
  }
  return previous.y;
}

export function compareChikunGhost({ run, ghost } = {}) {
  if (!run || !ghost) throw new Error('Chikun ghost comparison requires run and ghost results');
  if (normalizeSeed(run.seed) !== normalizeSeed(ghost.seed)) {
    throw new Error('Chikun ghost comparison requires the same seed');
  }
  const scoreDelta = run.score - ghost.score;
  const survivalDelta = run.survivalTicks - ghost.survivalTicks;
  return Object.freeze({
    seed: normalizeSeed(run.seed),
    runScore: run.score,
    ghostScore: ghost.score,
    scoreDelta,
    runSurvivalTicks: run.survivalTicks,
    ghostSurvivalTicks: ghost.survivalTicks,
    survivalDelta,
    beatGhost: scoreDelta > 0 || (scoreDelta === 0 && survivalDelta > 0),
  });
}

export function createChikunGhostRecord(result) {
  const track = buildChikunGhostTrack(result.evidence);
  return Object.freeze({
    version: CHIKUN_GHOST_STORAGE_VERSION,
    seed: track.seed,
    score: track.score,
    survivalTicks: track.survivalTicks,
    terminalTick: track.terminalTick,
    samples: track.samples,
  });
}

export function selectChikunGhostRecord(current, candidate) {
  if (!candidate) return current ?? null;
  if (!current) return candidate;
  if (normalizeSeed(candidate.seed) !== normalizeSeed(current.seed)) return current;
  if (candidate.score > current.score) return candidate;
  if (candidate.score === current.score && candidate.survivalTicks > current.survivalTicks) return candidate;
  return current;
}

export function chikunGhostStorageKey(seed) {
  return `${CHIKUN_GHOST_STORAGE_VERSION}:${normalizeSeed(seed)}`;
}

export function readChikunGhostRecord(storage, seed) {
  if (!storage?.getItem) return null;
  const raw = storage.getItem(chikunGhostStorageKey(seed));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== CHIKUN_GHOST_STORAGE_VERSION) return null;
    if (normalizeSeed(parsed.seed) !== normalizeSeed(seed)) return null;
    if (!Array.isArray(parsed.samples) || parsed.samples.length < 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeChikunGhostRecord(storage, record) {
  if (!storage?.setItem || !record) return null;
  const next = selectChikunGhostRecord(readChikunGhostRecord(storage, record.seed), record);
  storage.setItem(chikunGhostStorageKey(next.seed), JSON.stringify(next));
  return next;
}
