// Week math of the Chikun Weekly Jackpot (design §A.2), identical to
// WeeklyJackpot.weekOf / weekBounds. Pure; no imports beyond the board's own
// period keys, so the jackpot week and the weekly board can never disagree.
//
//   weekIndexOf(ts)            (ts + 3 days) / 1 week, ts in unix seconds
//   weekStartOf(index)         index * 1 week − 3 days (Monday 00:00 UTC)
//   weekKeyOfIndex(index)      periodKeyFor('weekly', start * 1000), 'YYYY-Www'
//   weekIndexOfKey(key)        the inverse, through periodStartMs('weekly', key)
//   boundsOf(index, extension) { start, close, settleCutoff, candidateUntil, payoutAt }
//                              in seconds; the last three include the admin
//                              extension, exactly as weekBounds(w) on chain
//   boundsIsoOf(index, ext)    the same bounds as ISO strings (the Neon row)
//   periodOfWeek(index)        { key, startMs, resetAt }: periodStartMs and
//                              periodKeyResetAt of the board's key
//   dateRangeLabel(start, …)   "Sep 28 – Oct 4, 2026" (Monday to Sunday), never
//                              an ISO week key (design §D.1)

import { periodKeyFor } from '../../apps/portal/src/leaderboard-engine.mjs';
import { periodKeyResetAt, periodStartMs } from '../neon/period-keys.mjs';

export const WEEK_SECONDS = 7 * 24 * 3600;
export const WEEK_SHIFT_SECONDS = 3 * 24 * 3600;
export const SETTLE_GRACE_SECONDS = 6 * 3600;
export const CANDIDATE_WINDOW_SECONDS = 12 * 3600;
export const PAYOUT_DELAY_SECONDS = 24 * 3600;
export const RELIST_MARGIN_SECONDS = 2 * 3600;
export const MAX_EXTENSION_SECONDS = 72 * 3600;
// The keeper's first selection pass is at close + 2 h (design J3).
export const SELECT_AFTER_SECONDS = 2 * 3600;
// The last re-select runs 10 minutes after the settle cutoff (design §C.4).
export const RESELECT_AFTER_CUTOFF_SECONDS = 10 * 60;
const WEEK_KEY = /^([0-9]{4})-W([0-9]{2})$/;

function seconds(value) {
  const number = typeof value === 'bigint' ? Number(value) : Number(value);
  if (!Number.isFinite(number) || number < 0) throw new TypeError(`not a non-negative unix time: ${value}`);
  return Math.floor(number);
}

function index(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new TypeError(`not a week index: ${value}`);
  return number;
}

export function weekIndexOf(tsSeconds) {
  return Math.floor((seconds(tsSeconds) + WEEK_SHIFT_SECONDS) / WEEK_SECONDS);
}

export function weekIndexOfMs(ms) {
  return weekIndexOf(Math.floor(Number(ms) / 1000));
}

export function weekStartOf(weekIndex) {
  return index(weekIndex) * WEEK_SECONDS - WEEK_SHIFT_SECONDS;
}

export function weekKeyOfIndex(weekIndex) {
  return periodKeyFor('weekly', weekStartOf(weekIndex) * 1000);
}

// 'YYYY-Www' → index, or null for a malformed key or one that does not
// round-trip (for example 2026-W54).
export function weekIndexOfKey(key) {
  if (typeof key !== 'string' || !WEEK_KEY.test(key)) return null;
  const startMs = periodStartMs('weekly', key);
  if (!Number.isFinite(startMs)) return null;
  const found = weekIndexOf(startMs / 1000);
  return found >= 1 && weekKeyOfIndex(found) === key ? found : null;
}

export function boundsOf(weekIndex, extensionSeconds = 0) {
  const start = weekStartOf(weekIndex);
  const close = start + WEEK_SECONDS;
  const extension = Math.max(0, Math.floor(Number(extensionSeconds) || 0));
  const shifted = close + extension;
  return Object.freeze({
    start,
    close,
    settleCutoff: shifted + SETTLE_GRACE_SECONDS,
    candidateUntil: shifted + CANDIDATE_WINDOW_SECONDS,
    payoutAt: shifted + PAYOUT_DELAY_SECONDS,
  });
}

const isoOf = (unixSeconds) => new Date(unixSeconds * 1000).toISOString();

export function boundsIsoOf(weekIndex, extensionSeconds = 0) {
  const bounds = boundsOf(weekIndex, extensionSeconds);
  return Object.freeze({
    startsAt: isoOf(bounds.start),
    closesAt: isoOf(bounds.close),
    settleCutoffAt: isoOf(bounds.settleCutoff),
    candidateUntil: isoOf(bounds.candidateUntil),
    payoutAt: isoOf(bounds.payoutAt),
  });
}

// The board's view of the same week: its key, first millisecond and reset.
export function periodOfWeek(weekIndex) {
  const key = weekKeyOfIndex(weekIndex);
  return Object.freeze({ key, startMs: periodStartMs('weekly', key), resetAt: periodKeyResetAt('weekly', key) });
}

// "Sep 28 – Oct 4, 2026": the Monday to the Sunday of a week, from its start
// (an ISO string, unix ms or a week index). The week is defined in UTC; a
// caller with a viewer's zone passes timeZone.
export function dateRangeLabel(start, { timeZone = 'UTC', locale = 'en-US' } = {}) {
  let startMs;
  if (typeof start === 'string') startMs = Date.parse(start);
  else if (Number.isSafeInteger(start) && start > 0 && start < 1e7) startMs = weekStartOf(start) * 1000;
  else startMs = Number(start);
  if (!Number.isFinite(startMs)) return '';
  const endMs = startMs + WEEK_SECONDS * 1000 - 24 * 3600 * 1000;
  const parts = (ms, options) => new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(new Date(ms));
  const startYear = parts(startMs, { year: 'numeric' });
  const endYear = parts(endMs, { year: 'numeric' });
  const monthDay = { month: 'short', day: 'numeric' };
  if (startYear === endYear) return `${parts(startMs, monthDay)} – ${parts(endMs, monthDay)}, ${endYear}`;
  return `${parts(startMs, { ...monthDay, year: 'numeric' })} – ${parts(endMs, { ...monthDay, year: 'numeric' })}`;
}
