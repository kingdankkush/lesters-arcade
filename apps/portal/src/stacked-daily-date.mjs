export const STACKED_DAILY_VERSION = 'stacked-daily-v1';
export function validStackedDailyDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function utcStackedDayKey(now = Date.now()) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid daily date');
  const day = date.toISOString().slice(0, 10);
  if (!validStackedDailyDay(day)) throw new TypeError('Daily date is outside the supported calendar');
  return day;
}
