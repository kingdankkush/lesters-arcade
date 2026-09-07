// Projection only: never owns enemy health, retirement, scoring or physics.
export const CORPSE_LIFETIME_MS = 2000;
export const CORPSE_VISUAL_CAP = 24;
const TICK_MS = 1000 / 60;
const FADE_MS = 200;

function time(value, integer = false) {
  if (!Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) throw new TypeError('invalid corpse clock');
  return value;
}

export function createCorpseClock(startTick, bornAtMs) {
  return Object.freeze({ startTick: time(startTick, true), endTick: startTick + 120, bornAtMs: time(bornAtMs) });
}

export function corpsePresentation(corpse, tick, nowMs) {
  const age = Math.max(0, (time(tick, true) - corpse.startTick) * TICK_MS, time(nowMs) - corpse.bornAtMs);
  const expired = age >= CORPSE_LIFETIME_MS;
  const fade = Math.max(0, Math.min(1, (age - (CORPSE_LIFETIME_MS - FADE_MS)) / FADE_MS));
  return { expired, alpha: expired ? 0 : 1 - fade * fade };
}

export function pruneCorpseCapacity(corpses, dispose) {
  if (!(corpses instanceof Map) || typeof dispose !== 'function') throw new TypeError('corpse map and disposer are required');
  while (corpses.size >= CORPSE_VISUAL_CAP) {
    const [id, corpse] = corpses.entries().next().value;
    corpses.delete(id);
    dispose(corpse);
  }
}
