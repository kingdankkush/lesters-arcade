import {STACKED_DAILY_VERSION, validStackedDailyDay, utcStackedDayKey} from './stacked-daily-date.mjs';
export {utcStackedDayKey} from './stacked-daily-date.mjs';
export const STACKED_DAILY_STORAGE_KEY = 'stacked-daily-best-v1';
const maxScore = 1_000_000_000_000;
const scoreValid = value => Number.isSafeInteger(value) && value >= 0 && value <= maxScore;
const token = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const season = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{1,63}$/.test(value);
const free = session => session?.gameId === 'stacked' && session.mode === 'free' && session.leaderboardEligible === false;
const exact = (value, keys) => value && Object.getPrototypeOf(value) === Object.prototype && Reflect.ownKeys(value).length === keys.length && keys.every(key => { const d = Object.getOwnPropertyDescriptor(value, key); return d?.enumerable && Object.hasOwn(d, 'value'); });

export function deriveStackedDailySeed(dayKey) {
  if (!validStackedDailyDay(dayKey)) throw new TypeError('Daily date must be a real YYYY-MM-DD UTC day');
  let hash = 0x811c9dc5;
  for (const character of `${STACKED_DAILY_VERSION}|stacked|${dayKey}`) hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193) >>> 0;
  return hash || 1;
}
// Only the parent calls this, before handing the seed to the existing cabinet.
export function bindStackedDailyChallenge(session, {now = Date.now()} = {}) {
  if (session?.gameId !== 'stacked') throw new TypeError('A STACKED session is required');
  if (!free(session)) return {...session, dailyChallenge: null};
  const dayKey = utcStackedDayKey(now), seed = deriveStackedDailySeed(dayKey);
  return {...session, seed,
    canonicalContext: session.canonicalContext ? Object.freeze({...session.canonicalContext, seed}) : session.canonicalContext,
    dailyChallenge: Object.freeze({version: STACKED_DAILY_VERSION, dayKey, seed})};
}
export function dailyChallengeForSession(session) {
  const daily = session?.dailyChallenge;
  if (!free(session) || !exact(daily, ['version', 'dayKey', 'seed']) || daily.version !== STACKED_DAILY_VERSION || !validStackedDailyDay(daily.dayKey)) return null;
  return daily.seed === session.seed && daily.seed === deriveStackedDailySeed(daily.dayKey) ? daily : null;
}
const identity = record => `${record.dayKey}|${record.buildHash}|${record.seasonId}`;
function readRecords(storage) {
  try {
    const raw = storage?.getItem?.(STACKED_DAILY_STORAGE_KEY);
    if (typeof raw !== 'string' || raw.length > 16384) return [];
    const data = JSON.parse(raw);
    if (!exact(data, ['version', 'records']) || data.version !== 1 || !Array.isArray(data.records) || data.records.length > 32) return [];
    const identities = new Set();
    for (const record of data.records) {
      if (!exact(record, ['dayKey', 'seed', 'buildHash', 'seasonId', 'score']) || !validStackedDailyDay(record.dayKey)
        || record.seed !== deriveStackedDailySeed(record.dayKey) || !token(record.buildHash) || !season(record.seasonId) || !scoreValid(record.score) || identities.has(identity(record))) return [];
      identities.add(identity(record));
    }
    return data.records;
  } catch { return []; }
}
export function readStackedDailyBest(storage, session) {
  const daily = dailyChallengeForSession(session);
  if (!daily) return null;
  return readRecords(storage).find(record => identity(record) === identity({...session, dayKey: daily.dayKey}))?.score ?? null;
}
// Called only after the host's replay worker and canonical-claim comparison pass.
// This device-local record is never an official score or achievement.
export function completeStackedDaily(session, result, storage) {
  const daily = dailyChallengeForSession(session), canonical = result?.canonical;
  if (!daily || result?.ok !== true || result.ranked !== false || canonical?.gameId !== 'stacked'
    || canonical.seed !== session.seed || canonical.buildHash !== session.buildHash || canonical.seasonId !== session.seasonId
    || !token(canonical.buildHash) || !season(canonical.seasonId) || !scoreValid(canonical.score)) return null;
  const records = readRecords(storage), candidate = {dayKey: daily.dayKey, seed: daily.seed, buildHash: canonical.buildHash, seasonId: canonical.seasonId, score: canonical.score};
  const previousBest = records.find(record => identity(record) === identity(candidate))?.score ?? null;
  const bestScore = Math.max(previousBest ?? 0, canonical.score), first = previousBest === null, newBest = !first && canonical.score > previousBest;
  const descending = (a, b) => identity(a) < identity(b) ? 1 : identity(a) > identity(b) ? -1 : 0;
  const next = records.filter(record => identity(record) !== identity(candidate)).sort(descending).slice(0, 31);
  next.push({...candidate, score: bestScore});
  next.sort(descending);
  let saved = false;
  try { if (typeof storage?.setItem === 'function') { storage.setItem(STACKED_DAILY_STORAGE_KEY, JSON.stringify({version: 1, records: next.slice(0, 32)})); saved = true; } } catch {}
  const message = !saved ? 'Daily replay verified. Device storage is unavailable; your daily best could not be saved.'
    : `${first ? 'First daily best' : newBest ? 'New daily best' : 'Daily best'}: ${bestScore.toLocaleString()} · ${daily.dayKey} UTC. ${canonical.score < bestScore ? `${(bestScore-canonical.score).toLocaleString()} points to match it. ` : ''}Kept on this device. Free retries; no Ranked progress.`;
  return {saved, first, newBest, previousBest, bestScore, gap: bestScore-canonical.score, message};
}
