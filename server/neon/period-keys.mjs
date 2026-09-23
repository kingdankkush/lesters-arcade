// Period keys for the verified-session index (contract §3.2, A26, D2).
//
// Keys come from leaderboard-engine.mjs periodKeyFor (weekly = ISO week with
// Monday UTC as day one, YYYY-Www; monthly = YYYY-MM; daily = YYYY-MM-DD), so
// the server and the browser agree. Keys are taken from the time the run was
// opened and never change after insert.

import { periodKeyFor } from '../../apps/portal/src/leaderboard-engine.mjs';

export const INDEX_PERIODS = Object.freeze(['weekly', 'monthly', 'all-time', 'daily']);

const KEY_FORMATS = Object.freeze({
  daily: /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/,
  weekly: /^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$/,
  monthly: /^[0-9]{4}-(0[1-9]|1[0-2])$/,
  'all-time': /^all-time$/,
});

const DAY_MS = 86_400_000;

export function periodKeysFor(ms) {
  const when = Number(ms);
  if (!Number.isFinite(when)) throw new TypeError('periodKeysFor needs a millisecond timestamp');
  return Object.freeze({
    day: periodKeyFor('daily', when),
    week: periodKeyFor('weekly', when),
    month: periodKeyFor('monthly', when),
  });
}

export function currentPeriodKey(period, ms) {
  if (!INDEX_PERIODS.includes(period)) throw new TypeError(`unknown period ${period}`);
  return periodKeyFor(period, Number(ms));
}

export function isValidPeriodKey(period, key) {
  const format = KEY_FORMATS[period];
  if (!format || typeof key !== 'string' || !format.test(key)) return false;
  if (period === 'daily') {
    const date = new Date(`${key}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && periodKeyFor('daily', date.getTime()) === key;
  }
  if (period === 'weekly') {
    const start = periodStartMs('weekly', key);
    return start !== null && periodKeyFor('weekly', start) === key;
  }
  return true;
}

function isoWeekStart(year, week) {
  // ISO week 1 contains January 4th; weeks start on Monday (UTC).
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Day = new Date(jan4).getUTCDay() || 7;
  const week1Monday = jan4 - (jan4Day - 1) * DAY_MS;
  return week1Monday + (week - 1) * 7 * DAY_MS;
}

// The first millisecond of the period a key names, or null for all-time.
export function periodStartMs(period, key) {
  if (period === 'all-time') return null;
  if (period === 'daily') return Date.parse(`${key}T00:00:00.000Z`);
  if (period === 'monthly') {
    const [year, month] = key.split('-').map(Number);
    return Date.UTC(year, month - 1, 1);
  }
  if (period === 'weekly') {
    const match = /^([0-9]{4})-W([0-9]{2})$/.exec(key);
    if (!match) return null;
    return isoWeekStart(Number(match[1]), Number(match[2]));
  }
  throw new TypeError(`unknown period ${period}`);
}

// When the period containing `ms` resets, as an ISO string; null for all-time.
export function periodResetAt(period, ms) {
  if (period === 'all-time') return null;
  return periodKeyResetAt(period, currentPeriodKey(period, ms));
}

// When the period a key names resets (the next period's first millisecond).
export function periodKeyResetAt(period, key) {
  if (period === 'all-time') return null;
  const start = periodStartMs(period, key);
  if (start === null || !Number.isFinite(start)) return null;
  const date = new Date(start);
  let next;
  if (period === 'daily') next = start + DAY_MS;
  else if (period === 'weekly') next = start + 7 * DAY_MS;
  else next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  return new Date(next).toISOString();
}
